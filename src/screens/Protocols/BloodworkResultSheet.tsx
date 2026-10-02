import React from "react";
import { Alert, Linking, View } from "react-native";
import { AppButton, AppInput, AppSheet, AppText, Chip, Disclosure, SearchInput } from "../../components/ui";
import type { ApiBiomarker, BloodworkResultInput } from "../../API/nouri/bloodworkTypes";
import { labResult } from "./bloodworkForm";
import { protocolStyles as styles } from "./protocolStyles";

export default function BloodworkResultSheet({ catalog, existing, used, onSave, onClose }: {
  catalog: ApiBiomarker[]; existing?: BloodworkResultInput; used: string[]; onSave: (result: BloodworkResultInput) => void; onClose: () => void;
}) {
  const [search,setSearch] = React.useState("");
  const [marker,setMarker] = React.useState(() => catalog.find((m) => m.id === existing?.biomarkerId));
  const [value,setValue] = React.useState(existing?.rawValue ?? "");
  const [unit,setUnit] = React.useState(existing?.rawUnit ?? "");
  const [low,setLow] = React.useState(existing?.referenceLow ?? "");
  const [high,setHigh] = React.useState(existing?.referenceHigh ?? "");
  const [referenceUnit,setReferenceUnit] = React.useState(existing?.referenceUnit ?? existing?.rawUnit ?? "");
  const [error,setError] = React.useState<string | null>(null);
  const original = React.useRef(JSON.stringify({ markerId: marker?.id,value,unit,low,high,referenceUnit }));
  const dirty = original.current !== JSON.stringify({ markerId: marker?.id,value,unit,low,high,referenceUnit });
  const discard = (leave: () => void) => {
    if (!dirty) { leave(); return; }
    Alert.alert("Discard result changes?","Your entered result changes have not been saved to this panel.",[
      { text: "Keep editing",style: "cancel" },{ text: "Discard",style: "destructive",onPress: leave },
    ]);
  };
  const select = (next: ApiBiomarker) => { setMarker(next); setUnit(next.canonicalUnit); setReferenceUnit(next.canonicalUnit); };
  return <AppSheet visible title={marker?.name ?? "Add a result"} onClose={() => discard(onClose)} keyboardAware>
    <View style={styles.content}>
      {!marker ? <>
        <SearchInput label="Search marker" placeholder="Name or category" value={search} onChangeText={setSearch} autoCorrect={false} />
        {catalog.filter((m) => m.active && !used.includes(m.id) && `${m.name} ${m.category}`.toLowerCase().includes(search.toLowerCase())).map((m) =>
          <AppButton key={m.id} label={`${m.name} · ${m.category}`} variant="secondary" onPress={() => select(m)} />)}
        {!catalog.some((m) => m.active && !used.includes(m.id) && `${m.name} ${m.category}`.toLowerCase().includes(search.toLowerCase())) ? <AppText color="secondary">No available markers match your search.</AppText> : null}
      </> : <>
        <AppInput label="Result" value={value} onChangeText={setValue} keyboardType="decimal-pad" maxLength={43} autoCorrect={false} />
        <AppText variant="metadata" color="secondary">Recorded unit</AppText>
        <View style={styles.row}>{marker.units.map((u) => <Chip key={u.unit} label={u.unit} selected={unit === u.unit} onPress={() => setUnit(u.unit)} />)}</View>
        <AppText variant="sectionTitle">Reference range</AppText>
        <AppText variant="bodySmall" color="secondary">Optional. Copy the bounds and unit from this laboratory result.</AppText>
        <AppInput label="Lower bound (optional)" value={low} onChangeText={setLow} keyboardType="decimal-pad" maxLength={43} />
        <AppInput label="Upper bound (optional)" value={high} onChangeText={setHigh} keyboardType="decimal-pad" maxLength={43} />
        {low.trim() || high.trim() ? <View style={styles.card}><AppText variant="metadata" color="secondary">Reference unit</AppText>
          <View style={styles.row}>{marker.units.map((u) => <Chip key={u.unit} label={u.unit} selected={referenceUnit === u.unit} onPress={() => setReferenceUnit(u.unit)} />)}</View></View> : null}
        {error ? <AppText color="error" accessibilityRole="alert">{error}</AppText> : null}
        <AppButton label={existing ? "Update result" : "Add result"} onPress={() => {
          try { onSave(labResult({ biomarkerId: marker.id,value,unit,low,high,referenceUnit })); }
          catch (cause) { setError(cause instanceof Error ? cause.message : "Check the entered result."); }
        }} />
        <Disclosure title="About this marker and its units">
          <View style={styles.card}><AppText variant="bodySmall">{marker.explanation}</AppText>
            {marker.sources.map((source) => <AppButton key={source.url} variant="ghost" label={source.title} onPress={() => { void Linking.openURL(source.url).catch(() => setError("Could not open the source.")); }} />)}</View>
        </Disclosure>
        {!existing ? <AppButton label="Choose another marker" variant="ghost" onPress={() => discard(() => { setMarker(undefined); setValue(""); setUnit(""); setLow(""); setHigh(""); setReferenceUnit(""); setError(null); })} /> : null}
      </>}
    </View>
  </AppSheet>;
}
