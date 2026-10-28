"use client";

import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import {
  faCalendarCheck,
  faCalendarDays,
  faCalendarPlus,
  faChevronRight,
  faCreditCard,
  faNotesMedical,
  faUser,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

config.autoAddCss = false;

const icons = {
  calendar: faCalendarDays,
  calendarPlus: faCalendarPlus,
  followUp: faCalendarCheck,
  payment: faCreditCard,
  notes: faNotesMedical,
  user: faUser,
  chevron: faChevronRight,
} satisfies Record<string, IconDefinition>;

export type PatientHomeIconName = keyof typeof icons;

export function PatientHomeIcon({ name, className }: { name: PatientHomeIconName; className?: string }) {
  return <FontAwesomeIcon icon={icons[name]} className={className} aria-hidden="true" />;
}
