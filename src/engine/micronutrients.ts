export type MicronutrientSex = "male" | "female";
export type MicronutrientAgeGroup = "19-50" | "51-70" | "71+";

export type OpenFoodMapMicronutrientKey =
  | "vitaminAUg"
  | "vitaminCMg"
  | "vitaminDUg"
  | "vitaminEMg"
  | "vitaminKUg"
  | "thiaminB1Mg"
  | "riboflavinB2Mg"
  | "niacinB3Mg"
  | "pantothenicAcidB5Mg"
  | "vitaminB6Mg"
  | "biotinB7Ug"
  | "folateB9Ug"
  | "vitaminB12Ug"
  | "cholineMg"
  | "calciumMg"
  | "chromiumUg"
  | "copperMg"
  | "iodineUg"
  | "ironMg"
  | "magnesiumMg"
  | "manganeseMg"
  | "molybdenumUg"
  | "phosphorusMg"
  | "potassiumMg"
  | "seleniumUg"
  | "sodiumMg"
  | "zincMg";

export type MicronutrientBasis = "RDA" | "AI";

export type MicronutrientTargetMap = Record<
  OpenFoodMapMicronutrientKey,
  number
>;

export type MicronutrientDataset = {
  data: Record<
    MicronutrientSex,
    Record<MicronutrientAgeGroup, MicronutrientTargetMap>
  >;
  basis: Record<OpenFoodMapMicronutrientKey, MicronutrientBasis>;
  generic: Record<OpenFoodMapMicronutrientKey, number>;
};

export const MICRONUTRIENT_TARGETS: MicronutrientDataset = {
  basis: {
    vitaminAUg: "RDA",
    vitaminCMg: "RDA",
    vitaminDUg: "RDA",
    vitaminEMg: "RDA",
    vitaminKUg: "AI",
    thiaminB1Mg: "RDA",
    riboflavinB2Mg: "RDA",
    niacinB3Mg: "RDA",
    pantothenicAcidB5Mg: "AI",
    vitaminB6Mg: "RDA",
    biotinB7Ug: "AI",
    folateB9Ug: "RDA",
    vitaminB12Ug: "RDA",
    cholineMg: "AI",
    calciumMg: "RDA",
    chromiumUg: "AI",
    copperMg: "RDA",
    iodineUg: "RDA",
    ironMg: "RDA",
    magnesiumMg: "RDA",
    manganeseMg: "AI",
    molybdenumUg: "RDA",
    phosphorusMg: "RDA",
    potassiumMg: "AI",
    seleniumUg: "RDA",
    sodiumMg: "AI",
    zincMg: "RDA",
  },
  generic: {
    vitaminAUg: 900,
    vitaminCMg: 90,
    vitaminDUg: 15,
    vitaminEMg: 15,
    vitaminKUg: 120,
    thiaminB1Mg: 1.2,
    riboflavinB2Mg: 1.3,
    niacinB3Mg: 16,
    pantothenicAcidB5Mg: 5,
    vitaminB6Mg: 1.3,
    biotinB7Ug: 30,
    folateB9Ug: 400,
    vitaminB12Ug: 2.4,
    cholineMg: 550,
    calciumMg: 1000,
    chromiumUg: 35,
    copperMg: 0.9,
    iodineUg: 150,
    ironMg: 8,
    magnesiumMg: 400,
    manganeseMg: 2.3,
    molybdenumUg: 45,
    phosphorusMg: 700,
    potassiumMg: 3400,
    seleniumUg: 55,
    sodiumMg: 1500,
    zincMg: 11,
  },
  data: {
    male: {
      "19-50": {
        vitaminAUg: 900,
        vitaminCMg: 90,
        vitaminDUg: 15,
        vitaminEMg: 15,
        vitaminKUg: 120,
        thiaminB1Mg: 1.2,
        riboflavinB2Mg: 1.3,
        niacinB3Mg: 16,
        pantothenicAcidB5Mg: 5,
        vitaminB6Mg: 1.3,
        biotinB7Ug: 30,
        folateB9Ug: 400,
        vitaminB12Ug: 2.4,
        cholineMg: 550,
        calciumMg: 1000,
        chromiumUg: 35,
        copperMg: 0.9,
        iodineUg: 150,
        ironMg: 8,
        magnesiumMg: 400,
        manganeseMg: 2.3,
        molybdenumUg: 45,
        phosphorusMg: 700,
        potassiumMg: 3400,
        seleniumUg: 55,
        sodiumMg: 1500,
        zincMg: 11,
      },
      "51-70": {
        vitaminAUg: 900,
        vitaminCMg: 90,
        vitaminDUg: 15,
        vitaminEMg: 15,
        vitaminKUg: 120,
        thiaminB1Mg: 1.2,
        riboflavinB2Mg: 1.3,
        niacinB3Mg: 16,
        pantothenicAcidB5Mg: 5,
        vitaminB6Mg: 1.7,
        biotinB7Ug: 30,
        folateB9Ug: 400,
        vitaminB12Ug: 2.4,
        cholineMg: 550,
        calciumMg: 1000,
        chromiumUg: 30,
        copperMg: 0.9,
        iodineUg: 150,
        ironMg: 8,
        magnesiumMg: 420,
        manganeseMg: 2.3,
        molybdenumUg: 45,
        phosphorusMg: 700,
        potassiumMg: 3400,
        seleniumUg: 55,
        sodiumMg: 1300,
        zincMg: 11,
      },
      "71+": {
        vitaminAUg: 900,
        vitaminCMg: 90,
        vitaminDUg: 20,
        vitaminEMg: 15,
        vitaminKUg: 120,
        thiaminB1Mg: 1.2,
        riboflavinB2Mg: 1.3,
        niacinB3Mg: 16,
        pantothenicAcidB5Mg: 5,
        vitaminB6Mg: 1.7,
        biotinB7Ug: 30,
        folateB9Ug: 400,
        vitaminB12Ug: 2.4,
        cholineMg: 550,
        calciumMg: 1200,
        chromiumUg: 30,
        copperMg: 0.9,
        iodineUg: 150,
        ironMg: 8,
        magnesiumMg: 420,
        manganeseMg: 2.3,
        molybdenumUg: 45,
        phosphorusMg: 700,
        potassiumMg: 3400,
        seleniumUg: 55,
        sodiumMg: 1200,
        zincMg: 11,
      },
    },
    female: {
      "19-50": {
        vitaminAUg: 700,
        vitaminCMg: 75,
        vitaminDUg: 15,
        vitaminEMg: 15,
        vitaminKUg: 90,
        thiaminB1Mg: 1.1,
        riboflavinB2Mg: 1.1,
        niacinB3Mg: 14,
        pantothenicAcidB5Mg: 5,
        vitaminB6Mg: 1.3,
        biotinB7Ug: 30,
        folateB9Ug: 400,
        vitaminB12Ug: 2.4,
        cholineMg: 425,
        calciumMg: 1000,
        chromiumUg: 25,
        copperMg: 0.9,
        iodineUg: 150,
        ironMg: 18,
        magnesiumMg: 310,
        manganeseMg: 1.8,
        molybdenumUg: 45,
        phosphorusMg: 700,
        potassiumMg: 2600,
        seleniumUg: 55,
        sodiumMg: 1500,
        zincMg: 8,
      },
      "51-70": {
        vitaminAUg: 700,
        vitaminCMg: 75,
        vitaminDUg: 15,
        vitaminEMg: 15,
        vitaminKUg: 90,
        thiaminB1Mg: 1.1,
        riboflavinB2Mg: 1.1,
        niacinB3Mg: 14,
        pantothenicAcidB5Mg: 5,
        vitaminB6Mg: 1.5,
        biotinB7Ug: 30,
        folateB9Ug: 400,
        vitaminB12Ug: 2.4,
        cholineMg: 425,
        calciumMg: 1200,
        chromiumUg: 20,
        copperMg: 0.9,
        iodineUg: 150,
        ironMg: 8,
        magnesiumMg: 320,
        manganeseMg: 1.8,
        molybdenumUg: 45,
        phosphorusMg: 700,
        potassiumMg: 2600,
        seleniumUg: 55,
        sodiumMg: 1300,
        zincMg: 8,
      },
      "71+": {
        vitaminAUg: 700,
        vitaminCMg: 75,
        vitaminDUg: 20,
        vitaminEMg: 15,
        vitaminKUg: 90,
        thiaminB1Mg: 1.1,
        riboflavinB2Mg: 1.1,
        niacinB3Mg: 14,
        pantothenicAcidB5Mg: 5,
        vitaminB6Mg: 1.5,
        biotinB7Ug: 30,
        folateB9Ug: 400,
        vitaminB12Ug: 2.4,
        cholineMg: 425,
        calciumMg: 1200,
        chromiumUg: 20,
        copperMg: 0.9,
        iodineUg: 150,
        ironMg: 8,
        magnesiumMg: 320,
        manganeseMg: 1.8,
        molybdenumUg: 45,
        phosphorusMg: 700,
        potassiumMg: 2600,
        seleniumUg: 55,
        sodiumMg: 1200,
        zincMg: 8,
      },
    },
  },
};

export type UserMicronutrientProfile = {
  sex: MicronutrientSex;
  age: number;
};

export function getMicronutrientAgeGroup(age: number): MicronutrientAgeGroup {
  if (age >= 71) return "71+";
  if (age >= 51) return "51-70";
  return "19-50";
}

export function getMicronutrientTargets(
  profile: UserMicronutrientProfile,
): MicronutrientTargetMap {
  const ageGroup = getMicronutrientAgeGroup(profile.age);
  return (
    MICRONUTRIENT_TARGETS.data[profile.sex]?.[ageGroup] ??
    MICRONUTRIENT_TARGETS.generic
  );
}

export function getMicronutrientTarget(
  profile: UserMicronutrientProfile,
  nutrientKey: OpenFoodMapMicronutrientKey,
): number {
  return getMicronutrientTargets(profile)[nutrientKey];
}

export function getMicronutrientBasis(
  nutrientKey: OpenFoodMapMicronutrientKey,
): MicronutrientBasis {
  return MICRONUTRIENT_TARGETS.basis[nutrientKey];
}

export function getMicronutrientProgress(params: {
  consumed: number | null | undefined;
  target: number;
  clampToHundred?: boolean;
}): number {
  const { consumed, target, clampToHundred = false } = params;

  if (consumed == null || target <= 0) return 0;

  const percent = (consumed / target) * 100;
  return clampToHundred ? Math.min(percent, 100) : percent;
}

export function getMicronutrientProgressForKey(params: {
  profile: UserMicronutrientProfile;
  nutrientKey: OpenFoodMapMicronutrientKey;
  consumed: number | null | undefined;
  clampToHundred?: boolean;
}): number {
  const target = getMicronutrientTarget(params.profile, params.nutrientKey);

  return getMicronutrientProgress({
    consumed: params.consumed,
    target,
    clampToHundred: params.clampToHundred,
  });
}
