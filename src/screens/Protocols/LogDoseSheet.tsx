import React from "react";
import { Alert, Keyboard, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { AppButton, AppInput, AppSheet, AppText, Chip, ErrorState, LoadingState, NumericText, OptionCard } from "../../components/ui";
import type { ApiProtocolActualDose, ApiProtocolCourse, ApiProtocolDoseLog, ApiProtocolOccurrence, ApiProtocolSites, CreateProtocolLogInput, EditProtocolLogInput } from "../../API/nouri/protocolTypes";
import type { ProtocolDoseUnit, ProtocolRoute } from "../../domain/types";
import { NouriApiError } from "../../API/nouri/client";
import { DB } from "../../store/DB";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import { currentProtocolPhase, displayProtocolInstant, protocolClock, protocolDate } from "./protocolForm";
import { useProtocolRead } from "./useProtocolRead";
import { useProtocolMutation } from "./useProtocolMutation";
import ProtocolDateField from "./ProtocolDateField";
import { protocolStyles as styles } from "./protocolStyles";

export type ProtocolLogTarget = { courseId: string; occurrenceId?: string; logId?: string };
type Context = { course: ApiProtocolCourse; occurrence: ApiProtocolOccurrence | null; log: ApiProtocolDoseLog | null; sites: ApiProtocolSites };
type Form = { amount: string; unit: ProtocolDoseUnit; route: ProtocolRoute; siteCode: string | null; date: string; time: string; originalAt: string };
type Command = { kind: "create"; input: CreateProtocolLogInput } | { kind: "edit"; id: string; input: EditProtocolLogInput };

export default function LogDoseSheet({ userId, target, onClose }: { userId: string; target: ProtocolLogTarget; onClose: () => void }) {
  const [siteOpen, setSiteOpen] = React.useState(false);
  const close = React.useRef(onClose);
  const query = useProtocolRead(userId, `log-context:${JSON.stringify(target)}`, async (): Promise<Context> => {
    const [course, sites, occurrence, log] = await Promise.all([
      DB.getProtocolCourse(userId, target.courseId), DB.getProtocolSites(userId),
      target.occurrenceId ? DB.getProtocolOccurrence(userId, target.occurrenceId, Intl.DateTimeFormat().resolvedOptions().timeZone) : null,
      target.logId ? DB.getProtocolLog(userId, target.logId) : null,
    ]);
    if ((occurrence && occurrence.courseId !== course.id) || (log && log.courseId !== course.id)) throw new Error("This dose does not belong to this course.");
    return { course, sites, occurrence, log: log ?? occurrence?.log ?? null };
  });
  return <AppSheet visible keyboardAware title={siteOpen ? "Injection site" : query.data?.log ? "Edit recorded dose" : "Log dose"} onClose={() => close.current()}>
    {!query.data && query.loading ? <LoadingState title="Loading dose" /> : null}
    {!query.data && query.error ? <ErrorState title="Could not load dose" message={query.error} action={<AppButton label="Try again" onPress={() => void query.reload()} />} /> : null}
    {query.data ? <DoseForm userId={userId} context={query.data} onClose={onClose} registerClose={(handler) => { close.current = handler; }} siteOpen={siteOpen} setSiteOpen={setSiteOpen} /> : null}
  </AppSheet>;
}

function DoseForm({ userId, context, onClose, registerClose, siteOpen, setSiteOpen }: {
  userId: string; context: Context; onClose: () => void; registerClose: (handler: () => void) => void;
  siteOpen: boolean; setSiteOpen: (open: boolean) => void;
}) {
  const { course, occurrence, sites } = context;
  const [log, setLog] = React.useState(context.log);
  const phase = course.phases.find((item) => item.id === (log?.phaseId ?? occurrence?.phaseId)) ?? currentProtocolPhase(course);
  const timezone = phase.timezone;
  const { timeFormat } = useDisplayPreferences();
  const format = (at: string) => displayProtocolInstant(at, timezone, timeFormat === "12h");
  const planned = occurrence?.planned ?? log?.planned;
  const defaults = (): Form => {
    const schedule = phase.schedule;
    const dose = "doses" in schedule ? schedule.doses[0]! : schedule.kind === "specific_weekdays" ? schedule.days[0]!.doses[0]! : schedule;
    const previous = sites.recentRoutes.find((item) => course.compound.routes.includes(item.route));
    const now = new Date().toISOString();
    const at = log?.actual.at ?? (planned && protocolDate(planned.at, timezone) < protocolDate(now, timezone) ? planned.at : now);
    return { amount: log?.actual.amount ?? planned?.amount ?? dose.amount, unit: log?.actual.unit ?? planned?.unit ?? dose.unit,
      route: log?.actual.route ?? previous?.route ?? phase.route, siteCode: log ? log.actual.siteCode : previous?.siteCode ?? null,
      date: protocolDate(at, timezone), time: protocolClock(at, timezone), originalAt: at };
  };
  const [form, setForm] = React.useState<Form>(defaults);
  const original = React.useRef(JSON.stringify(form));
  const command = React.useRef<Command | null>(null);
  const mutation = useProtocolMutation();
  const locked = mutation.busy || command.current !== null;
  const changed = JSON.stringify(form) !== original.current;
  const patch = (fields: Partial<Form>) => setForm((old) => ({ ...old, ...fields }));
  const siteLabel = (code: string | null) => sites.sites.find((site) => site.code === code)?.label ?? "Not recorded";
  const close = () => {
    if (mutation.busy) return;
    if (siteOpen) { setSiteOpen(false); return; }
    if (!changed && !command.current) { onClose(); return; }
    Alert.alert(command.current ? "Close this dose?" : "Discard dose changes?", command.current
      ? "The save may already have reached Nouri. Reopen the dose to check its recorded values before trying a new log."
      : "Your entered changes have not been saved.", [
      { text: "Keep editing", style: "cancel" }, { text: "Close", style: "destructive", onPress: onClose },
    ]);
  };
  registerClose(close);

  const confirm = async () => {
    const accepted = await mutation.run(async () => {
      if (!command.current) {
        const amount = form.amount.trim().replace(",", ".");
        if (!/^(?:0|[1-9]\d{0,29})(?:\.\d{1,12})?$/.test(amount) || !/[1-9]/.test(amount)) throw new Error("Enter a positive amount with up to 12 decimal places.");
        // Preserve an unchanged absolute instant, including a later DST fold
        // and recorded seconds. Changed civil fields use the server resolver.
        const at = form.date === protocolDate(form.originalAt, timezone) && form.time === protocolClock(form.originalAt, timezone)
          ? form.originalAt : (await DB.previewProtocolTime(userId, { date: form.date, time: form.time, timezone })).at;
        const actual: ApiProtocolActualDose = { at, amount, unit: form.unit, route: form.route, siteCode: form.siteCode };
        command.current = log ? { kind: "edit", id: log.id, input: { operationId: randomUUID(), expectedRevision: log.revision, actual } }
          : { kind: "create", input: { id: randomUUID(), actual } };
      }
      const selected = command.current;
      if (selected.kind === "edit") return DB.editProtocolLog(userId, selected.id, selected.input);
      return occurrence ? DB.logProtocolOccurrence(userId, occurrence.id, selected.input) : DB.createProtocolManualLog(userId, course.id, selected.input);
    });
    if (accepted) onClose();
  };

  const refreshRecorded = async () => {
    const result = await mutation.run(async () => {
      const id = command.current?.kind === "create" ? command.current.input.id : log?.id;
      let latest: ApiProtocolDoseLog | null = null;
      if (id) {
        try { latest = await DB.getProtocolLog(userId, id); }
        catch (error) { if (!(error instanceof NouriApiError && error.isNotFound && !log)) throw error; }
      }
      if (!latest && occurrence) latest = (await DB.getProtocolOccurrence(userId, occurrence.id, timezone)).log;
      return { latest };
    });
    if (!result) return;
    command.current = null;
    if (result.latest) {
      setLog(result.latest);
      const actual = result.latest.actual;
      const next: Form = { ...actual, date: protocolDate(actual.at, timezone), time: protocolClock(actual.at, timezone), originalAt: actual.at };
      original.current = JSON.stringify(next); setForm(next);
    }
  };
  const remove = () => {
    if (!log) return;
    Alert.alert("Delete recorded dose?", log.occurrenceId ? "This removes the actual dose and its injection-site history. The planned administration remains unlogged." : "This permanently removes this manual administration and its injection-site history.", [
      { text: "Cancel", style: "cancel" }, { text: "Delete dose", style: "destructive", onPress: () => {
        void mutation.run(async () => {
          try { return await DB.deleteProtocolLog(userId, log.id); }
          catch (error) { if (error instanceof NouriApiError && error.isNotFound) return { deleted: true }; throw error; }
        }).then((result) => { if (result) onClose(); });
      } },
    ]);
  };

  if (siteOpen) return <View style={styles.content}>
    <AppButton label="Back to dose" variant="ghost" onPress={() => setSiteOpen(false)} />
    <AppText color="secondary">Record where you administered this dose. Recent sites show your history.</AppText>
    <OptionCard title="Not recorded" selected={form.siteCode === null} onPress={() => { patch({ siteCode: null }); setSiteOpen(false); }} />
    {sites.recent.some((item) => course.compound.routes.includes(item.route)) ? <>
      <AppText variant="metadata" color="secondary">RECENT</AppText>
      {sites.recent.filter((item) => course.compound.routes.includes(item.route)).map((item) => <OptionCard key={`recent:${item.code}`} title={siteLabel(item.code)} subtitle={`${item.route === "SC" ? "SubQ" : "IM"} · ${format(item.lastUsedAt)}`} selected={form.siteCode === item.code}
        onPress={() => { patch({ route: item.route, siteCode: item.code }); setSiteOpen(false); }} />)}
    </> : null}
    {course.compound.routes.map((route) => <View key={route} style={styles.card}>
      <AppText variant="metadata" color="secondary">{route === "SC" ? "SUBQ" : "IM"}</AppText>
      {sites.sites.filter((item) => item.route === route).map((item) => <OptionCard key={item.code} title={item.label} selected={form.siteCode === item.code}
        onPress={() => { patch({ route, siteCode: item.code }); setSiteOpen(false); }} />)}
    </View>)}
  </View>;

  const allowed = course.status !== "DRAFT" && (log || !occurrence || occurrence.canLog);
  return <View style={styles.content}>
    <AppText variant="sectionTitle">{course.compound.name}</AppText>
    {planned ? <View style={styles.card}>
      <AppText variant="metadata" color="secondary">PLANNED</AppText>
      <NumericText align="left">{planned.amount} {planned.unit} · {planned.route === "SC" ? "SubQ" : "IM"}</NumericText>
      <AppText color="secondary">{format(planned.at)}</AppText>
    </View> : <AppText color="secondary">Manual administration · no scheduled occurrence</AppText>}
    <AppInput label="Actual amount" keyboardType="decimal-pad" value={form.amount} editable={!locked} onChangeText={(amount) => patch({ amount })} />
    <View style={styles.row}>{course.compound.doseUnits.map((unit) => <Chip key={unit} label={unit} selected={form.unit === unit} disabled={locked}
      onPress={() => { if (unit !== form.unit) patch({ unit, amount: "" }); }} />)}</View>
    <ProtocolDateField label="Taken on" value={form.date} disabled={locked} onChange={(date) => patch({ date })} />
    <ProtocolDateField label="Taken at" mode="time" value={form.time} disabled={locked} onChange={(time) => patch({ time })} />
    <AppButton label="Use current time" variant="ghost" disabled={locked} onPress={() => { const at = new Date().toISOString(); patch({ date: protocolDate(at, timezone), time: protocolClock(at, timezone), originalAt: at }); }} />
    <AppText variant="bodySmall" color="secondary">Times use {timezone}. Recording a different time or amount keeps the planned schedule unchanged.</AppText>
    <AppText variant="metadata" color="secondary">ACTUAL ROUTE</AppText>
    <View style={styles.row}>{course.compound.routes.map((route) => <Chip key={route} label={route === "SC" ? "SubQ" : "IM"} selected={form.route === route} disabled={locked}
      onPress={() => patch({ route, siteCode: sites.sites.some((site) => site.code === form.siteCode && site.route === route) ? form.siteCode : null })} />)}</View>
    <AppButton label={`Injection site · ${siteLabel(form.siteCode)}`} variant="secondary" disabled={locked} onPress={() => { Keyboard.dismiss(); setSiteOpen(true); }} />
    {sites.recent[0] ? <AppText variant="bodySmall" color="secondary">Last used · {siteLabel(sites.recent[0].code)} · {format(sites.recent[0].lastUsedAt)}</AppText> : null}
    {mutation.error ? <AppText color="error" accessibilityRole="alert">{mutation.error}</AppText> : null}
    {!allowed ? <AppText color="secondary">{course.status === "DRAFT" ? "Start tracking this course before logging a dose." : "This future-date dose cannot be completed in advance."}</AppText> :
      <AppButton label={mutation.busy ? "Saving…" : command.current ? "Retry confirmation" : log ? "Confirm changes" : "Confirm dose"} disabled={mutation.busy} onPress={() => void confirm()} />}
    {mutation.error && command.current ? <AppButton label="Reload recorded dose" variant="secondary" disabled={mutation.busy} onPress={() => void refreshRecorded()} /> : null}
    {log ? <AppButton label="Delete recorded dose" variant="danger" disabled={locked} onPress={remove} /> : null}
  </View>;
}
