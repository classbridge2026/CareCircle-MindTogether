"use client";

import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import {
  faCalendarCheck,
  faCalendarDays,
  faChevronRight,
  faClock,
  faHeart,
  faNotesMedical,
  faPlay,
  faPlus,
  faUser,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

config.autoAddCss = false;

const icons = {
  calendar: faCalendarDays,
  followUp: faCalendarCheck,
  patient: faUser,
  notes: faNotesMedical,
  clock: faClock,
  plus: faPlus,
  play: faPlay,
  heart: faHeart,
  chevron: faChevronRight,
} satisfies Record<string, IconDefinition>;

export type DashIconName = keyof typeof icons;

export function DashIcon({ name, className }: { name: DashIconName; className?: string }) {
  return <FontAwesomeIcon icon={icons[name]} className={className} aria-hidden="true" />;
}
