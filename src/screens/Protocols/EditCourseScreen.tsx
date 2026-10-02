import React from "react";
import { Alert, View } from "react-native";
import { usePreventRemove } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { randomUUID } from "expo-crypto";
import { AppButton, AppCard, AppScreen, AppText, Chip, ErrorState, LoadingState, OptionCard, ScreenHeader } from "../../components/ui";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import { DB } from "../../store/DB";
import { useAppSelector } from "../../store/hooks";
import { getDeviceTimeZone, NouriApiError } from "../../API/nouri/client";
import type { ApiProtocolCompoundDetail, ApiProtocolCourse, ApiProtocolSchedulePreview, CreateProtocolCourseInput } from "../../API/nouri/protocolTypes";
import type { ProtocolPhase, ProtocolPhaseConfiguration } from "../../domain/types";
import type { ProtocolStackParamList } from "../../navigation/protocolTypes";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import { addProtocolDate, configurationDraft, currentProtocolPhase, displayProtocolDate, displayProtocolInstant, protocolDate, resolveProtocolConfiguration } from "./protocolForm";
import { useProtocolRead } from "./useProtocolRead";
import { useProtocolMutation } from "./useProtocolMutation";
import ScheduleEditor from "./ScheduleEditor";
import ScheduleSummary from "./ScheduleSummary";
import ProtocolDateField from "./ProtocolDateField";
import { protocolStyles as styles } from "./protocolStyles";

type Props = NativeStackScreenProps<ProtocolStackParamList, "EditCourse">;
type Preview = { configuration: ProtocolPhaseConfiguration; startAt: string; endAt: string | null; phases: ProtocolPhase[]; result: ApiProtocolSchedulePreview; until: string };
export default function EditCourseScreen(props: Props) {
  const userId = useAppSelector((state) => state.user.currentUser?.externalId) ?? "";
  const { route, navigation } = props;
  const query = useProtocolRead(userId, `edit:${route.params.courseId ?? route.params.compoundId}`, async () => {
    const course = route.params.courseId ? await DB.getProtocolCourse(userId, route.params.courseId) : undefined;
    const compound = await DB.getProtocolCompound(userId, course?.compound.id ?? route.params.compoundId!);
    return { course, compound };
  });
  if (!query.data) return <AppScreen><ScreenHeader title="Configure compound" onBack={() => navigation.goBack()} />{query.error ? <ErrorState title="Could not load configuration" message={query.error} action={<AppButton label="Try again" onPress={() => void query.reload()} />} /> : <LoadingState title="Loading configuration" />}</AppScreen>;
  return <CourseForm key={`${userId}:${route.params.courseId ?? route.params.compoundId}`} {...props} userId={userId} compound={query.data.compound} course={query.data.course} />;
}

function CourseForm({ navigation, userId, compound, course: initialCourse }: Props & { userId: string; compound: ApiProtocolCompoundDetail; course?: ApiProtocolCourse }) {
  const [course, setCourse] = React.useState(initialCourse);
  const phase = course ? currentProtocolPhase(course) : undefined;
  const timezone = phase?.timezone ?? getDeviceTimeZone();
  const today = protocolDate(new Date(), timezone);
  const [configuration, setConfiguration] = React.useState(() => {
    const value = configurationDraft(phase, timezone, randomUUID());
    return phase ? value : { ...value, route: compound.routes[0]!, doses: value.doses.map((dose) => ({ ...dose, unit: compound.doseUnits[0]! })) };
  });
  const [startDate, setStartDate] = React.useState(course ? protocolDate(course.startAt, timezone) : today);
  const [endDate, setEndDate] = React.useState(course?.endAt ? protocolDate(new Date(Date.parse(course.endAt) - 1), timezone) : today);
  const [hasEnd, setHasEnd] = React.useState(Boolean(course?.endAt));
  const [effectiveDate, setEffectiveDate] = React.useState(course && course.startAt > new Date().toISOString() ? protocolDate(course.startAt, timezone) : today);
  const [futureChanges, setFutureChanges] = React.useState<"keep" | "replace">("keep");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [intent, setIntent] = React.useState<"draft" | "start" | "change" | null>(null);
  const original = React.useRef(JSON.stringify({ configuration, startDate, endDate, hasEnd, effectiveDate, futureChanges }));
  const operationId = React.useRef(randomUUID());
  const startOperationId = React.useRef(randomUUID());
  const courseId = React.useRef(course?.id ?? randomUUID());
  const initialPhaseId = React.useRef(phase?.id ?? randomUUID());
  const created = React.useRef<ApiProtocolCourse | null>(null);
  const allowExit = React.useRef(false);
  const mutation = useProtocolMutation();
  const { timeFormat } = useDisplayPreferences();
  const active = Boolean(course && course.status !== "DRAFT");
  const dirty = original.current !== JSON.stringify({ configuration, startDate, endDate, hasEnd, effectiveDate, futureChanges });
  const locked = mutation.busy || intent !== null;
  usePreventRemove(dirty || mutation.busy || intent !== null, ({ data }) => {
    if (allowExit.current) { navigation.dispatch(data.action); return; }
    if (mutation.busy) return;
    if (preview && !intent) { setPreview(null); return; }
    Alert.alert(intent ? "Leave this save?" : "Discard changes?", intent ? "The request may already have saved a course or change. Check the course before creating another." : "Your unsaved configuration will be discarded.", [
      { text: "Keep editing", style: "cancel" }, { text: "Leave", style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });
  const buildPreview = async () => {
    const result = await mutation.run(async (): Promise<Preview> => {
      if (course?.status === "ENDED") throw new Error("This course has ended. Start a new course instead.");
      if (hasEnd && endDate < startDate) throw new Error("The end date must be on or after the start date.");
      if (active && effectiveDate < today) throw new Error("Schedule changes must begin today or on a future date.");
      const resolve = (input: Parameters<typeof DB.previewProtocolTime>[1]) => DB.previewProtocolTime(userId, input);
      const config = await resolveProtocolConfiguration(configuration, resolve);
      // Keep an untouched draft's exact start/end instants. Native date controls
      // expose civil dates; only changed boundaries need timezone resolution.
      const startAt = course && startDate === protocolDate(course.startAt, timezone) ? course.startAt : (await resolve({ date: startDate, time: "00:00", timezone })).at;
      const endAt = active ? course!.endAt : !hasEnd ? null : course?.endAt && endDate === protocolDate(new Date(Date.parse(course.endAt) - 1), timezone) ? course.endAt : (await resolve({ date: addProtocolDate(endDate, 1), time: "00:00", timezone })).at;
      const effectiveAt = active ? effectiveDate === today ? new Date().toISOString() : (await resolve({ date: effectiveDate, time: "00:00", timezone })).at : startAt;
      const phases: ProtocolPhase[] = active ? [
        ...course!.phases.filter((item) => item.effectiveFrom < effectiveAt),
        { id: operationId.current, effectiveFrom: effectiveAt, ...config },
        ...(futureChanges === "keep" ? course!.phases.filter((item) => item.effectiveFrom > effectiveAt) : []),
      ] : [{ id: initialPhaseId.current, effectiveFrom: startAt, ...config }];
      const previewFrom = active ? effectiveAt : startAt;
      const schedule = config.schedule;
      const days = schedule.kind === "every_n_days" ? Math.min(7305, Math.max(30, schedule.intervalDays * 4)) : schedule.kind === "every_n_hours" ? Math.min(7305, Math.max(30, Math.ceil(schedule.intervalHours * 4 / 24))) : 30;
      const until = new Date(Math.max(Date.parse(previewFrom) + days * 86_400_000, schedule.kind === "one_time" ? Date.parse(schedule.at) + 86_400_000 : 0)).toISOString();
      return { configuration: config, startAt, endAt, phases, until, result: await DB.previewProtocolSchedule(userId, { phases, startAt: previewFrom, endAt: until, courseEndAt: endAt }) };
    });
    if (result) setPreview(result);
  };
  const save = async (requested: "draft" | "start" | "change") => {
    if (!preview) return;
    const selected = intent ?? requested;
    setIntent(selected);
    const saved = await mutation.run(async () => {
      if (active) return DB.changeProtocolPhase(userId, course!.id, { ...preview.configuration, expectedRevision: course!.revision, operationId: operationId.current, effectiveDate, futureChanges });
      if (course && !created.current) created.current = await DB.editProtocolDraft(userId, course.id, { ...preview.configuration, expectedRevision: course.revision, operationId: operationId.current, startAt: preview.startAt, endAt: preview.endAt });
      if (!created.current) {
        const input: CreateProtocolCourseInput = { ...preview.configuration, id: courseId.current, compoundId: compound.id, startAt: preview.startAt, endAt: preview.endAt };
        created.current = await DB.createProtocolCourse(userId, input);
      }
      return selected === "start" ? DB.startProtocolCourse(userId, created.current.id, { operationId: startOperationId.current, expectedRevision: created.current.revision }) : created.current;
    });
    if (saved) { allowExit.current = true; navigation.replace("CourseDetail", { courseId: saved.id }); }
  };
  const reviewAgain = async () => {
    const checked = await mutation.run(async () => {
      try { return { latest: await DB.getProtocolCourse(userId, courseId.current) }; }
      catch (error) {
        if (!course && error instanceof NouriApiError && error.isNotFound) return { latest: undefined };
        throw error;
      }
    });
    if (!checked) return;
    if (checked.latest?.status === "ENDED" || (intent === "start" && checked.latest?.status === "ACTIVE")) {
      allowExit.current = true; navigation.replace("CourseDetail", { courseId: checked.latest.id }); return;
    }
    setCourse(checked.latest);
    operationId.current = randomUUID(); startOperationId.current = randomUUID(); created.current = null;
    setIntent(null); setPreview(null);
  };
  const later = course?.phases.filter((item) => protocolDate(item.effectiveFrom, timezone) >= effectiveDate && Date.parse(item.effectiveFrom) > Date.now()) ?? [];
  return <AppScreen safeBottom>
    <ScreenHeader title={preview ? "Your schedule" : compound.name} onBack={() => preview && !intent ? setPreview(null) : navigation.goBack()} />
    <KeyboardAwareScrollView key={preview ? "preview" : "configuration"} contentContainerStyle={styles.content}>
      {preview ? <>
        <AppCard style={styles.card}><AppText variant="sectionTitle">{compound.name}</AppText><ScheduleSummary configuration={preview.configuration} />
          <AppText color="secondary" variant="bodySmall">{active ? `Change effective ${displayProtocolDate(effectiveDate)}${effectiveDate === today ? " when saved" : ""}` : `Starts ${displayProtocolDate(startDate)}`}</AppText>
          <AppText color="secondary" variant="bodySmall">{preview.endAt ? `Ends ${displayProtocolDate(protocolDate(new Date(Date.parse(preview.endAt) - 1), timezone))}` : "No end date"}</AppText>
        </AppCard>
        <AppCard style={styles.card}><AppText variant="cardTitle">Scheduled administrations</AppText>
          {preview.result.occurrences.length ? preview.result.occurrences.slice(0, 20).map((item) => <View key={`${item.phaseId}:${item.slotKey}:${item.scheduledAt}`}><AppText>{displayProtocolInstant(item.scheduledAt, timezone, timeFormat === "12h")}</AppText><AppText color="secondary">{item.amount} {item.unit} · {item.route}</AppText></View>) : <AppText color="secondary">{configuration.kind === "as_needed" ? "As-needed courses have no scheduled doses. Log each administration manually." : "No administrations fall in this preview window. Check the anchor, dates and schedule."}</AppText>}
          <AppText color="secondary" variant="bodySmall">{preview.result.occurrences.length > 20 ? "First 20 shown. " : ""}Preview through {displayProtocolDate(protocolDate(preview.until, timezone))}. Past scheduled doses stay unlogged until you record what you actually took.</AppText>
        </AppCard>
        {!intent ? <AppButton label="Edit configuration" variant="secondary" disabled={mutation.busy} onPress={() => setPreview(null)} /> : null}
        {!active && !intent ? <AppButton label="Preview estimated levels" variant="secondary" disabled={mutation.busy} onPress={() => navigation.navigate("PreviewLevels", {
          configuration: { ...preview.configuration, id: courseId.current, compoundId: compound.id, startAt: preview.startAt, endAt: preview.endAt },
        })} /> : null}
        {intent ? <AppButton label={mutation.busy ? "Saving…" : "Retry save"} disabled={mutation.busy} onPress={() => void save(intent)} /> : active ? <AppButton label="Save change" disabled={mutation.busy} onPress={() => void save("change")} /> : <>
          <AppButton label="Start tracking" disabled={mutation.busy} onPress={() => void save("start")} />
          <AppButton label="Save as draft" variant="secondary" disabled={mutation.busy} onPress={() => void save("draft")} />
        </>}
        {intent && !mutation.busy ? <AppButton label="Open course" variant="ghost" onPress={() => { allowExit.current = true; navigation.replace("CourseDetail", { courseId: courseId.current }); }} /> : null}
        {intent && mutation.error ? <AppButton label="Review configuration again" variant="secondary" disabled={mutation.busy} onPress={() => void reviewAgain()} /> : null}
      </> : <>
        <AppCard style={styles.card}><AppText variant="cardTitle">Route</AppText><View style={styles.row}>{compound.routes.map((route) => <Chip key={route} label={route} selected={configuration.route === route} disabled={locked} onPress={() => setConfiguration({ ...configuration, route })} />)}</View></AppCard>
        <ScheduleEditor value={configuration} onChange={setConfiguration} units={compound.doseUnits} disabled={locked} />
        {active ? <AppCard style={styles.card}>
          <AppText variant="cardTitle">Effective date</AppText>
          <AppButton label="Today" variant="secondary" disabled={locked} onPress={() => setEffectiveDate(today)} />
          <ProtocolDateField label="Change begins" value={effectiveDate} disabled={locked} onChange={setEffectiveDate} />
          {later.length ? <>
            <AppText color="secondary">A future change is already scheduled for {displayProtocolDate(protocolDate(later[0]!.effectiveFrom, timezone))}.</AppText>
            <OptionCard title="Keep future changes" subtitle="These settings apply until the next scheduled change." selected={futureChanges === "keep"} disabled={locked} onPress={() => setFutureChanges("keep")} />
            <OptionCard title="Replace future changes" subtitle="Remove later changes where recorded doses do not prevent replacement." selected={futureChanges === "replace"} disabled={locked} onPress={() => setFutureChanges("replace")} />
          </> : null}
        </AppCard> : <AppCard style={styles.card}>
          <ProtocolDateField label="Starts" value={startDate} disabled={locked} onChange={(date) => { setStartDate(date); if (!course && configuration.anchorDate === startDate) setConfiguration({ ...configuration, anchorDate: date }); }} />
          <OptionCard title="No end date" selected={!hasEnd} disabled={locked} onPress={() => setHasEnd(false)} />
          <OptionCard title="End on date" selected={hasEnd} disabled={locked} onPress={() => setHasEnd(true)} />
          {hasEnd ? <ProtocolDateField label="Last day" value={endDate} disabled={locked} onChange={setEndDate} /> : null}
        </AppCard>}
        <AppButton label={mutation.busy ? "Preparing preview…" : "Continue to preview"} disabled={locked} onPress={() => void buildPreview()} />
      </>}
      {mutation.error ? <AppText accessibilityRole="alert" color="error">{mutation.error}</AppText> : null}
    </KeyboardAwareScrollView>
  </AppScreen>;
}
