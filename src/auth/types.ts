export type OnboardingData = {
  name: string;
  priorities: string[];
  dayStart: string;
  dayEnd: string;
};
export type StrideProfile = OnboardingData & { userId: string };
