import { CaretLeftIcon } from "phosphor-react-native";
import { ScreenHeader } from "../../components/ui/AppScreen";
import { appColors } from "../../theme/colors";

type SettingsStackHeaderProps = {
  eyebrow?: string;
  onBack: () => void;
  subtitle?: string;
  title: string;
};

const SettingsStackHeader = ({
  eyebrow,
  onBack,
  subtitle,
  title,
}: SettingsStackHeaderProps) => (
  <ScreenHeader
    backIcon={
      <CaretLeftIcon size={20} color={appColors.textPrimary} weight="bold" />
    }
    eyebrow={eyebrow}
    onBack={onBack}
    safeTop={false}
    subtitle={subtitle}
    title={title}
  />
);

export default SettingsStackHeader;
