"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Database, FeaturedEventMediaType } from "@/lib/supabase/database";

type Client = ReturnType<typeof createClient>;
type FeaturedEvent = Database["public"]["Tables"]["featured_events"]["Row"];
type EventForm = {
  title: string;
  description: string;
  media_type: FeaturedEventMediaType;
  media_url: string;
  thumbnail_url: string;
  cta_text: string;
  cta_url: string;
  is_active: boolean;
  sort_order: string;
  starts_at: string;
  ends_at: string;
};

const bucketName = "featured-events";
const pendingStartsAt = "9999-12-31T23:59:59.999Z";
const imageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const videoExtensions: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};
const inputClassName =
  "mt-2 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#3c8aba] focus:ring-2 focus:ring-[#3c8aba]/15 disabled:bg-slate-100";

class AdminAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAccessError";
  }
}

function emptyForm(): EventForm {
  return {
    title: "",
    description: "",
    media_type: "image",
    media_url: "",
    thumbnail_url: "",
    cta_text: "",
    cta_url: "",
    is_active: true,
    sort_order: "0",
    starts_at: "",
    ends_at: "",
  };
}

function toDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function toDateTimeValue(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMediaType(type: FeaturedEventMediaType) {
  return type === "video" ? "Video" : "Image";
}

async function requireAdmin(client: Client) {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user) {
    throw new AdminAccessError("Sesi tidak valid. Silakan login kembali.");
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || profile?.role !== "admin") {
    throw new AdminAccessError("Halaman ini hanya dapat diakses oleh admin.");
  }
}

function fileExtension(file: File, mediaType: FeaturedEventMediaType) {
  return mediaType === "image"
    ? imageExtensions[file.type]
    : videoExtensions[file.type];
}

function safeFilename(file: File, extension: string) {
  const baseName = file.name
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
  return `${crypto.randomUUID()}-${baseName || "media"}.${extension}`;
}

function getEventObjectPath(
  client: Client,
  eventId: string,
  publicUrl: string | null,
) {
  if (!publicUrl) return null;

  try {
    const bucketUrl = new URL(
      client.storage.from(bucketName).getPublicUrl("").data.publicUrl,
    );
    const mediaUrl = new URL(publicUrl);
    const bucketRoot = bucketUrl.pathname.endsWith("/")
      ? bucketUrl.pathname
      : `${bucketUrl.pathname}/`;
    if (
      mediaUrl.origin !== bucketUrl.origin ||
      !mediaUrl.pathname.startsWith(bucketRoot)
    ) {
      return null;
    }

    const path = decodeURIComponent(mediaUrl.pathname.slice(bucketRoot.length));
    const segments = path.split("/");
    if (
      !path.startsWith(`featured-events/${eventId}/`) ||
      segments.some((segment) => segment === "..") ||
      !["media", "thumbnail"].includes(segments[2] ?? "") ||
      segments.length < 4
    ) {
      return null;
    }
    return path;
  } catch {
    return null;
  }
}

function eventStoragePath(
  eventId: string,
  kind: "media" | "thumbnail",
  file: File,
  extension: string,
) {
  return `featured-events/${eventId}/${kind}/${safeFilename(file, extension)}`;
}

async function uploadFile(
  client: Client,
  eventId: string,
  kind: "media" | "thumbnail",
  file: File,
  extension: string,
) {
  const path = eventStoragePath(eventId, kind, file, extension);
  const { error } = await client.storage.from(bucketName).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;

  return {
    path,
    publicUrl: client.storage.from(bucketName).getPublicUrl(path).data
      .publicUrl,
  };
}

function isValidDateWindow(startsAt: string, endsAt: string) {
  return !startsAt || !endsAt || new Date(endsAt) >= new Date(startsAt);
}

export default function FeaturedEventsManager() {
  const [supabase] = useState(() =>
    isSupabaseConfigured ? createClient() : null,
  );
  const [events, setEvents] = useState<FeaturedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<FeaturedEvent | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadEvents = useCallback(async () => {
    if (!supabase) {
      setError("Supabase belum dikonfigurasi.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      await requireAdmin(supabase);
      const { data, error: queryError } = await supabase
        .from("featured_events")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (queryError) throw queryError;
      setEvents(data ?? []);
      setError("");
    } catch (loadError) {
      setEvents([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Event gagal dimuat. Silakan coba lagi.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (!mediaFile) {
      setMediaPreview("");
      return;
    }
    const objectUrl = URL.createObjectURL(mediaFile);
    setMediaPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [mediaFile]);

  useEffect(() => {
    if (!thumbnailFile) {
      setThumbnailPreview("");
      return;
    }
    const objectUrl = URL.createObjectURL(thumbnailFile);
    setThumbnailPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [thumbnailFile]);

  function clearForm() {
    setIsFormOpen(false);
    setEditingEvent(null);
    setForm(emptyForm());
    setMediaFile(null);
    setThumbnailFile(null);
    setError("");
    setNotice("");
  }

  function editEvent(event: FeaturedEvent) {
    setIsFormOpen(true);
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description ?? "",
      media_type: event.media_type,
      media_url: event.media_url,
      thumbnail_url: event.thumbnail_url ?? "",
      cta_text: event.cta_text ?? "",
      cta_url: event.cta_url ?? "",
      is_active: event.is_active,
      sort_order: String(event.sort_order),
      starts_at: toDateTimeInput(event.starts_at),
      ends_at: toDateTimeInput(event.ends_at),
    });
    setMediaFile(null);
    setThumbnailFile(null);
    setError("");
    setNotice("");
  }

  function validateForm() {
    const title = form.title.trim();
    const sortOrder = Number(form.sort_order);
    const extension = mediaFile
      ? fileExtension(mediaFile, form.media_type)
      : null;
    const thumbnailExtension = thumbnailFile
      ? imageExtensions[thumbnailFile.type]
      : null;

    if (!title) return "Judul event wajib diisi.";
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      return "Urutan harus berupa bilangan bulat nol atau lebih.";
    }
    if (!isValidDateWindow(form.starts_at, form.ends_at)) {
      return "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.";
    }
    if (!editingEvent && !mediaFile) {
      return "Pilih file media untuk event baru.";
    }
    if (mediaFile && !extension) {
      return form.media_type === "image"
        ? "Format gambar harus JPG, PNG, atau WebP."
        : "Format video harus MP4, WebM, atau MOV.";
    }
    if (
      editingEvent &&
      !mediaFile &&
      editingEvent.media_type !== form.media_type
    ) {
      return "Pilih media baru ketika tipe media diubah.";
    }
    if (thumbnailFile && !thumbnailExtension) {
      return "Thumbnail harus berupa JPG, PNG, atau WebP.";
    }
    if (!editingEvent && !form.media_url && !mediaFile) {
      return "Media event wajib tersedia.";
    }
    return "";
  }

  async function removeUploadedPaths(paths: string[]) {
    if (!supabase || paths.length === 0) return true;
    const { error: cleanupError } = await supabase.storage
      .from(bucketName)
      .remove(paths);
    return !cleanupError;
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || isSaving) return;

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setNotice("");
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");
    const uploadedPaths: string[] = [];
    let createdEventId: string | null = null;
    let eventSaved = false;

    try {
      await requireAdmin(supabase);
      const mediaExtension = mediaFile
        ? fileExtension(mediaFile, form.media_type)
        : null;
      const thumbnailExtension = thumbnailFile
        ? imageExtensions[thumbnailFile.type]
        : null;
      let eventId = editingEvent?.id ?? null;
      let nextMediaUrl = form.media_url.trim();
      let nextThumbnailUrl = form.thumbnail_url.trim() || null;

      if (!editingEvent) {
        const pendingUrl = supabase.storage
          .from(bucketName)
          .getPublicUrl(
            `featured-events/pending/media/${crypto.randomUUID()}.jpg`,
          ).data.publicUrl;
        const { data, error: createError } = await supabase.rpc(
          "admin_create_featured_event",
          {
            p_title: form.title.trim(),
            p_description: form.description.trim() || null,
            p_media_type: form.media_type,
            p_media_url: pendingUrl,
            p_thumbnail_url: null,
            p_cta_text: form.cta_text.trim() || null,
            p_cta_url: form.cta_url.trim() || null,
            p_sort_order: Number(form.sort_order),
            p_starts_at: pendingStartsAt,
            p_ends_at: null,
          },
        );
        if (createError) throw createError;
        if (!data) throw new Error("Event belum mendapatkan ID.");
        eventId = data;
        createdEventId = data;

        const { error: statusError } = await supabase.rpc(
          "admin_update_featured_event_status",
          { p_event_id: data, p_is_active: false },
        );
        if (statusError) throw statusError;
      }

      if (!eventId) throw new Error("Event ID tidak tersedia.");
      if (mediaFile && mediaExtension) {
        const uploaded = await uploadFile(
          supabase,
          eventId,
          "media",
          mediaFile,
          mediaExtension,
        );
        uploadedPaths.push(uploaded.path);
        nextMediaUrl = uploaded.publicUrl;
      }
      if (thumbnailFile && thumbnailExtension) {
        const uploaded = await uploadFile(
          supabase,
          eventId,
          "thumbnail",
          thumbnailFile,
          thumbnailExtension,
        );
        uploadedPaths.push(uploaded.path);
        nextThumbnailUrl = uploaded.publicUrl;
      }

      const { error: updateError } = await supabase.rpc(
        "admin_update_featured_event",
        {
          p_event_id: eventId,
          p_title: form.title.trim(),
          p_description: form.description.trim() || null,
          p_media_type: form.media_type,
          p_media_url: nextMediaUrl,
          p_thumbnail_url: nextThumbnailUrl,
          p_cta_text: form.cta_text.trim() || null,
          p_cta_url: form.cta_url.trim() || null,
          p_sort_order: Number(form.sort_order),
          p_starts_at: toDateTimeValue(form.starts_at),
          p_ends_at: toDateTimeValue(form.ends_at),
        },
      );
      if (updateError) throw updateError;
      eventSaved = true;

      const { error: statusError } = await supabase.rpc(
        "admin_update_featured_event_status",
        { p_event_id: eventId, p_is_active: form.is_active },
      );
      if (statusError) {
        await loadEvents();
        setError(
          "Event tersimpan, tetapi status aktifnya gagal diperbarui. Periksa daftar event sebelum mencoba lagi.",
        );
        return;
      }

      const previousPaths = editingEvent
        ? [
            mediaFile
              ? getEventObjectPath(
                  supabase,
                  editingEvent.id,
                  editingEvent.media_url,
                )
              : null,
            thumbnailFile
              ? getEventObjectPath(
                  supabase,
                  editingEvent.id,
                  editingEvent.thumbnail_url,
                )
              : null,
          ].filter((path): path is string => Boolean(path))
        : [];
      const previousMediaWasExternal = Boolean(
        editingEvent &&
        mediaFile &&
        editingEvent.media_url &&
        !getEventObjectPath(supabase, editingEvent.id, editingEvent.media_url),
      );
      const previousThumbnailWasExternal = Boolean(
        editingEvent &&
        thumbnailFile &&
        editingEvent.thumbnail_url &&
        !getEventObjectPath(
          supabase,
          editingEvent.id,
          editingEvent.thumbnail_url,
        ),
      );
      const oldFilesRemoved = await removeUploadedPaths(previousPaths);

      const successNotice =
        !oldFilesRemoved ||
        previousMediaWasExternal ||
        previousThumbnailWasExternal
          ? "Event tersimpan. Media lama mungkin perlu dihapus manual dari Storage."
          : editingEvent
            ? "Event berhasil diperbarui."
            : "Event berhasil dibuat.";
      clearForm();
      setNotice(successNotice);
      await loadEvents();
    } catch (saveError) {
      console.error("[Featured Events] Save failed.", saveError);
      if (createdEventId && !eventSaved) {
        const { error: deleteError } = await supabase.rpc(
          "admin_delete_featured_event",
          { p_event_id: createdEventId },
        );
        if (!deleteError) {
          const pathsRemoved = await removeUploadedPaths(uploadedPaths);
          setError(
            pathsRemoved
              ? "Event gagal disimpan. Row sementara dan file upload sudah dibersihkan. Silakan coba lagi."
              : "Event gagal disimpan dan sebagian file upload belum terhapus. Hapus file tersebut secara manual dari Storage.",
          );
        } else {
          setError(
            "Event belum selesai disimpan dan cleanup row gagal. Event tetap tersembunyi; hapus row pending dan file Storage secara manual.",
          );
        }
      } else {
        if (!eventSaved) {
          const pathsRemoved = await removeUploadedPaths(uploadedPaths);
          setError(
            pathsRemoved
              ? saveError instanceof Error
                ? saveError.message
                : "Event gagal disimpan. Silakan periksa kembali data."
              : "Event gagal disimpan; sebagian file baru perlu dihapus manual dari Storage.",
          );
        } else {
          setError(
            "Data event tersimpan, tetapi proses lanjutan gagal. Segarkan daftar dan periksa status event.",
          );
        }
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleStatus(event: FeaturedEvent) {
    if (!supabase || isSaving || busyEventId) return;
    setBusyEventId(event.id);
    setError("");
    setNotice("");
    try {
      await requireAdmin(supabase);
      const { error: statusError } = await supabase.rpc(
        "admin_update_featured_event_status",
        { p_event_id: event.id, p_is_active: !event.is_active },
      );
      if (statusError) throw statusError;
      setNotice("Status event berhasil diperbarui.");
      await loadEvents();
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Status event gagal diperbarui.",
      );
    } finally {
      setBusyEventId(null);
    }
  }

  async function deleteEvent(event: FeaturedEvent) {
    if (!supabase || isSaving || busyEventId) return;
    if (
      !window.confirm(
        `Hapus event “${event.title}”? Tindakan ini tidak bisa dibatalkan.`,
      )
    ) {
      return;
    }

    setBusyEventId(event.id);
    setError("");
    setNotice("");
    try {
      await requireAdmin(supabase);
      const { error: deleteError } = await supabase.rpc(
        "admin_delete_featured_event",
        { p_event_id: event.id },
      );
      if (deleteError) throw deleteError;

      const mediaPath = getEventObjectPath(supabase, event.id, event.media_url);
      const thumbnailPath = getEventObjectPath(
        supabase,
        event.id,
        event.thumbnail_url,
      );
      const paths = Array.from(
        new Set(
          [mediaPath, thumbnailPath].filter((path): path is string =>
            Boolean(path),
          ),
        ),
      );
      const hasUnmanagedUrl = Boolean(
        (event.media_url && !mediaPath) ||
        (event.thumbnail_url && !thumbnailPath),
      );
      const filesRemoved = await removeUploadedPaths(paths);

      setNotice(
        filesRemoved && !hasUnmanagedUrl
          ? "Event dan media Storage berhasil dihapus."
          : "Record event berhasil dihapus. Sebagian media Storage mungkin perlu dihapus manual.",
      );
      if (editingEvent?.id === event.id) clearForm();
      await loadEvents();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Event gagal dihapus. Silakan coba lagi.",
      );
    } finally {
      setBusyEventId(null);
    }
  }

  const previewMediaUrl = mediaPreview || form.media_url;
  const previewThumbnailUrl = thumbnailPreview || form.thumbnail_url;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#c48a24]">
              Homepage content
            </p>
            <h2 className="mt-1 text-xl font-extrabold text-[#0F3854]">
              Featured Events
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Kelola event yang tampil pada carousel homepage.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadEvents()}
              disabled={isLoading || isSaving}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-[#0F3854] transition hover:border-[#E5B869] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Segarkan
            </button>
            <button
              type="button"
              onClick={() => {
                clearForm();
                setIsFormOpen(true);
                setError("");
              }}
              disabled={isSaving}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#3C7B9E] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#2f627d] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Event baru
            </button>
          </div>
        </header>

        {(error || notice) && (
          <div
            role={error ? "alert" : "status"}
            className={`mb-5 rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
          >
            {error || notice}
          </div>
        )}

        {isLoading ? (
          <div className="flex min-h-36 items-center justify-center gap-2 text-sm font-semibold text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Memuat featured events
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center">
            <ImagePlus className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 font-bold text-[#0F3854]">
              Belum ada featured event
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Buat event pertama untuk mulai mengisi carousel homepage.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {events.map((event) => (
              <article
                key={event.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <div className="grid sm:grid-cols-[180px_minmax(0,1fr)]">
                  <div className="relative aspect-video bg-[#F8F5E8] sm:aspect-auto sm:min-h-44">
                    {event.thumbnail_url || event.media_type === "image" ? (
                      <Image
                        src={event.thumbnail_url || event.media_url}
                        alt={`Preview ${event.title}`}
                        fill
                        unoptimized
                        sizes="(min-width: 640px) 180px, 100vw"
                        className="object-cover"
                      />
                    ) : (
                      <video
                        src={event.media_url}
                        poster={event.thumbnail_url ?? undefined}
                        muted
                        playsInline
                        controls
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="break-words font-extrabold text-[#0F3854]">
                          {event.title}
                        </h3>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {formatMediaType(event.media_type)} · Urutan{" "}
                          {event.sort_order}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${event.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                      >
                        {event.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
                      <p>Mulai: {formatDate(event.starts_at)}</p>
                      <p>Selesai: {formatDate(event.ends_at)}</p>
                      <p className="sm:col-span-2">
                        Dibuat: {formatDate(event.created_at)}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => editEvent(event)}
                        disabled={isSaving || !!busyEventId}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[#0F3854] transition hover:border-[#E5B869] disabled:opacity-50"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleStatus(event)}
                        disabled={isSaving || busyEventId === event.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[#0F3854] transition hover:border-[#E5B869] disabled:opacity-50"
                      >
                        {busyEventId === event.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        {event.is_active ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteEvent(event)}
                        disabled={isSaving || busyEventId === event.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Hapus
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {isFormOpen && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#c48a24]">
                {editingEvent ? "Edit event" : "Event form"}
              </p>
              <h2 className="mt-1 text-lg font-extrabold text-[#0F3854]">
                {editingEvent ? editingEvent.title : "Detail featured event"}
              </h2>
            </div>
            {(editingEvent || events.length > 0) && (
              <button
                type="button"
                onClick={clearForm}
                disabled={isSaving}
                aria-label="Tutup form"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <form
            onSubmit={(event) => void saveEvent(event)}
            className="space-y-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-[#0F3854] sm:col-span-2">
                Judul
                <input
                  required
                  value={form.title}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      title: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  disabled={isSaving}
                />
              </label>
              <label className="text-sm font-bold text-[#0F3854] sm:col-span-2">
                Deskripsi
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  className={inputClassName}
                  disabled={isSaving}
                />
              </label>
              <label className="text-sm font-bold text-[#0F3854]">
                Tipe media
                <select
                  value={form.media_type}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      media_type: event.target.value as FeaturedEventMediaType,
                    }))
                  }
                  className={inputClassName}
                  disabled={isSaving}
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
              </label>
              <label className="text-sm font-bold text-[#0F3854]">
                Urutan
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={form.sort_order}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      sort_order: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  disabled={isSaving}
                />
              </label>
              <label className="text-sm font-bold text-[#0F3854] sm:col-span-2">
                File media {editingEvent ? "(pilih untuk mengganti)" : ""}
                <input
                  key={`media-${editingEvent?.id ?? "new"}-${form.media_type}`}
                  type="file"
                  accept={
                    form.media_type === "image"
                      ? "image/jpeg,image/png,image/webp"
                      : "video/mp4,video/webm,video/quicktime"
                  }
                  onChange={(event) =>
                    setMediaFile(event.target.files?.[0] ?? null)
                  }
                  className={inputClassName}
                  disabled={isSaving}
                  required={!editingEvent}
                />
              </label>
              {previewMediaUrl && (
                <div className="sm:col-span-2">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Preview media
                  </p>
                  {form.media_type === "video" ? (
                    <video
                      key={previewMediaUrl}
                      src={previewMediaUrl}
                      poster={previewThumbnailUrl || undefined}
                      controls
                      muted
                      playsInline
                      className="max-h-72 w-full rounded-lg border border-slate-200 bg-slate-950 object-contain"
                    />
                  ) : (
                    <div className="relative aspect-video max-h-72 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      <Image
                        src={previewMediaUrl}
                        alt="Preview media event"
                        fill
                        unoptimized
                        sizes="(min-width: 640px) 640px, 100vw"
                        className="object-contain"
                      />
                    </div>
                  )}
                </div>
              )}
              <label className="text-sm font-bold text-[#0F3854] sm:col-span-2">
                Thumbnail / poster (opsional)
                <input
                  key={`thumbnail-${editingEvent?.id ?? "new"}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    setThumbnailFile(event.target.files?.[0] ?? null)
                  }
                  className={inputClassName}
                  disabled={isSaving}
                />
              </label>
              {previewThumbnailUrl && (
                <div className="relative h-36 w-56 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <Image
                    src={previewThumbnailUrl}
                    alt="Preview thumbnail event"
                    fill
                    unoptimized
                    sizes="224px"
                    className="object-cover"
                  />
                </div>
              )}
              <label className="text-sm font-bold text-[#0F3854]">
                CTA text
                <input
                  value={form.cta_text}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      cta_text: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  disabled={isSaving}
                />
              </label>
              <label className="text-sm font-bold text-[#0F3854]">
                CTA URL
                <input
                  type="text"
                  value={form.cta_url}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      cta_url: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  disabled={isSaving}
                />
              </label>
              <label className="text-sm font-bold text-[#0F3854]">
                Mulai tampil
                <input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      starts_at: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  disabled={isSaving}
                />
              </label>
              <label className="text-sm font-bold text-[#0F3854]">
                Akhir tampil
                <input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      ends_at: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  disabled={isSaving}
                />
              </label>
              <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3.5 text-sm font-bold text-[#0F3854] sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      is_active: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-[#3C7B9E]"
                  disabled={isSaving}
                />
                Aktifkan event setelah tersimpan
              </label>
            </div>

            {isSaving && (
              <p
                role="status"
                className="flex items-center gap-2 text-sm font-semibold text-[#0F3854]"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                {mediaFile || thumbnailFile
                  ? "Menyimpan data dan mengunggah media..."
                  : "Menyimpan event..."}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#3C7B9E] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#2f627d] disabled:cursor-wait disabled:opacity-60"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {isSaving ? "Memproses..." : "Simpan event"}
              </button>
              <button
                type="button"
                onClick={clearForm}
                disabled={isSaving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <X className="h-4 w-4" /> Batal
              </button>
            </div>
            <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
              Event baru tetap tersembunyi selama proses upload. Jika
              penghapusan media gagal setelah event dihapus, bersihkan objek
              terkait secara manual dari bucket Storage.
            </p>
          </form>
        </section>
      )}
    </div>
  );
}
