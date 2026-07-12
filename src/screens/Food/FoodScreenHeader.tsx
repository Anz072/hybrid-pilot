import { ScreenHeader } from "../../components/ui/AppScreen";

type FoodScreenHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
};

const FoodScreenHeader = ({
  eyebrow,
  title,
  subtitle,
  onBack,
}: FoodScreenHeaderProps) => (
  <ScreenHeader
    eyebrow={eyebrow}
    onBack={onBack}
    subtitle={subtitle}
    title={title}
  />
);

export default FoodScreenHeader;
