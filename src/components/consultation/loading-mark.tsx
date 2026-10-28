import { CareCircleSpinner } from "@/components/brand";

export function ConsultationLoadingMark() {
  return (
    <div className="grid h-full min-h-dvh place-items-center bg-[#F3F8FC]" role="status" aria-label="Loading">
      <CareCircleSpinner />
    </div>
  );
}
