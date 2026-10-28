"use client";

import { useActionState, useState } from "react";
import { primaryButtonClass } from "@/components/form-classes";
import { removeProfileImageAction, saveProfileImageAction, type ProfileImageState } from "@/app/profile/actions";
import { profileImageSrc } from "@/components/profile-image-src";

export function ProfilePhoto({
  userId,
  version,
  size = 40,
  alt = "",
}: {
  userId: string;
  name: string;
  version: string | null;
  size?: number;
  alt?: string;
}) {
  const style = { width: size, height: size };
  if (!version) {
    return (
      <img
        className="inline-flex shrink-0 rounded-full"
        style={style}
        src="/default-avatar.svg"
        alt={alt}
        width={size}
        height={size}
      />
    );
  }
  return (
    <img
      className="inline-flex shrink-0 rounded-full bg-brand-navy object-cover"
      style={style}
      src={profileImageSrc(userId, version)}
      alt={alt}
      width={size}
      height={size}
    />
  );
}

const initial: ProfileImageState = {};

function PhotoFileField() {
  const [fileName, setFileName] = useState("");
  return (
    <div className="grid gap-2">
      <span className="text-sm font-semibold text-brand-navy">Profile photo</span>
      <div className="flex flex-wrap items-center gap-3">
        <input
          id="profile-photo-file"
          className="peer sr-only"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? "")}
        />
        <label
          htmlFor="profile-photo-file"
          className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border-2 border-solid border-[#0b5f59] bg-[#0F766E] px-4 text-sm font-semibold text-white transition hover:border-[#084842] hover:bg-[#0b5f59] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#0F766E]"
        >
          Choose photo
        </label>
        <span className={`min-w-0 truncate text-sm ${fileName ? "text-brand-navy" : "text-brand-muted"}`}>{fileName || "No file chosen"}</span>
      </div>
    </div>
  );
}

export function ProfilePhotoEditor({ userId, name, version }: { userId: string; name: string; version: string | null }) {
  const [saved, save, saving] = useActionState(saveProfileImageAction, initial);
  const [removed, remove, removing] = useActionState(removeProfileImageAction, initial);
  const message = saved.message || removed.message;
  const tone = saved.message ? saved.tone : removed.tone;
  return (
    <div className="flex flex-wrap items-start gap-4">
      <ProfilePhoto userId={userId} name={name} version={version} size={72} alt={`${name} profile photo`} />
      <div className="grid min-w-0 flex-1 gap-3">
        <form action={save} className="grid gap-2">
          <PhotoFileField />
          <p className="text-xs leading-5 text-brand-muted">JPEG, PNG, or WebP. 2 MB or smaller. This photo is shown beside your name.</p>
          <div>
            <button className={primaryButtonClass} disabled={saving} type="submit">
              {saving ? "Saving…" : "Save photo"}
            </button>
          </div>
        </form>
        {version ? (
          <form action={remove}>
            <button className="inline-flex h-11 items-center rounded-xl border border-brand-line bg-white px-4 text-sm font-semibold text-brand-navy" disabled={removing} type="submit">
              {removing ? "Removing…" : "Remove photo"}
            </button>
          </form>
        ) : null}
        {message ? (
          <p className={tone === "error" ? "text-sm text-red-700" : "text-sm text-brand-navy"} role={tone === "error" ? "alert" : "status"}>
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
