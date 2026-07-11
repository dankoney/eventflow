/** Dial codes for public registration (digits only, no +). Ghana first as default. */
export type PhoneDialOption = {
  value: string;
  country: string;
};

export const PHONE_DIAL_OPTIONS: PhoneDialOption[] = [
  { value: "233", country: "Ghana" },
  { value: "1", country: "US / Canada" },
  { value: "44", country: "United Kingdom" },
  { value: "353", country: "Ireland" },
  { value: "27", country: "South Africa" },
  { value: "234", country: "Nigeria" },
  { value: "254", country: "Kenya" },
  { value: "256", country: "Uganda" },
  { value: "250", country: "Rwanda" },
  { value: "255", country: "Tanzania" },
  { value: "49", country: "Germany" },
  { value: "33", country: "France" },
  { value: "31", country: "Netherlands" },
  { value: "32", country: "Belgium" },
  { value: "34", country: "Spain" },
  { value: "39", country: "Italy" },
  { value: "971", country: "UAE" },
  { value: "966", country: "Saudi Arabia" },
  { value: "91", country: "India" },
  { value: "65", country: "Singapore" },
  { value: "60", country: "Malaysia" },
  { value: "81", country: "Japan" },
  { value: "82", country: "South Korea" },
  { value: "86", country: "China" },
  { value: "852", country: "Hong Kong" },
  { value: "61", country: "Australia" },
  { value: "64", country: "New Zealand" },
  { value: "55", country: "Brazil" },
  { value: "52", country: "Mexico" }
];

export const DEFAULT_PHONE_DIAL = "233";
