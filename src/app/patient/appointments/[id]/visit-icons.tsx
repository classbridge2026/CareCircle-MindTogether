"use client";

import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import {
  faArrowLeft,
  faCalendarDays,
  faClipboardList,
  faClock,
  faCreditCard,
  faFileMedical,
  faHospital,
  faLocationDot,
  faUserDoctor,
  faVideo,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

config.autoAddCss = false;

const icons = {
  back: faArrowLeft,
  calendar: faCalendarDays,
  clock: faClock,
  video: faVideo,
  location: faLocationDot,
  hospital: faHospital,
  doctor: faUserDoctor,
  clipboard: faClipboardList,
  payment: faCreditCard,
  summary: faFileMedical,
} satisfies Record<string, IconDefinition>;

export type VisitIconName = keyof typeof icons;

export function VisitIcon({ name }: { name: VisitIconName }) {
  return <FontAwesomeIcon icon={icons[name]} aria-hidden="true" />;
}
