"use client";

import { useState, useRef } from "react";
import { Star, Mic, Square, RotateCcw, CheckCircle2, Loader2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { submitCustomerReviewAction } from "@/server/actions/reviews";
import { useUploadThing } from "@/lib/uploadthing-client";

export function CustomerReviewForm({
  subdomain,
  storeId,
  orderId,
  orderCode,
  customerName: initialName,
  customerPhone: initialPhone,
  defaultProductId,
}: {
  subdomain: string;
  storeId: string;
  orderId: string | null;
  orderCode: string | null;
  customerName: string;
  customerPhone: string;
  defaultProductId: string | null;
}) {
  const [rating, setRating] = useState(5);
  const [name, setName] = useState(initialName || "");
  const [phone, setPhone] = useState(initialPhone || "");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // منطق تسجيل الفويس نوت الحي
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<any>(null);

  const { startUpload } = useUploadThing("customerAudioReview");

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
      };

      mediaRecorder.start();
      setRecording(true);
      setAudioDuration(0);

      timerRef.current = setInterval(() => {
        setAudioDuration((sec) => {
          if (sec >= 59) {
            stopRecording();
            return 60;
          }
          return sec + 1;
        });
      }, 1000);
    } catch {
      toast.error("يرجى السماح بصلاحية المايكروفون لتسجيل رأيك الصوتي");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      clearInterval(timerRef.current);
      setRecording(false);
    }
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setAudioDuration(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("اكتب اسمك أولاً");
    if (!body.trim() && !audioBlob) return toast.error("شاركنا رأيك كتابةً أو بتسجيل صوتي");

    setSubmitting(true);
    try {
      let finalAudioUrl: string | null = null;

      // رفع الفويس نوت الفعلي إلى التخزين السحابي
      if (audioBlob) {
        const audioFile = new File([audioBlob], `review-voice-${Date.now()}.webm`, {
          type: "audio/webm",
        });

        const uploadRes = await startUpload([audioFile], { subdomain });
        if (uploadRes && uploadRes[0]?.ufsUrl) {
          finalAudioUrl = uploadRes[0].ufsUrl;
        } else if (uploadRes && uploadRes[0]?.url) {
          finalAudioUrl = uploadRes[0].url;
        }
      }

      const res = await submitCustomerReviewAction({
        storeId,
        orderId,
        customerName: name.trim(),
        customerPhone: phone.trim() || undefined,
        rating,
        body: body.trim() || undefined,
        audioUrl: finalAudioUrl,
        audioDurationSeconds: audioDuration || undefined,
        imageUrls: [],
        productId: defaultProductId,
      });

      if (res.ok) {
        setDone(true);
        toast.success("شكراً جزيلاً لمشاركتك رأيك القيم!");
      } else {
        toast.error(res.error || "حدث خطأ أثناء إرسال التقييم");
      }
    } catch (err) {
      console.error("[CustomerReviewForm] Error submitting review:", err);
      toast.error("تعذر حفظ التقييم، يرجى المحاولة ثانية");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="py-8 text-center space-y-3">
        <div className="size-16 rounded-full bg-emerald-50 text-emerald-600 grid place-items-center mx-auto">
          <CheckCircle2 className="size-8" />
        </div>
        <h3 className="text-lg font-black text-slate-900">شكراً لك من القلب!</h3>
        <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
          تم استلام رأيك بنجاح وسيتم عرضه في صفحة آراء العملاء بعد اعتماده من إدارة المتجر.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* اختيار النجوم */}
      <div className="text-center space-y-1.5 pb-2">
        <label className="text-xs font-bold text-slate-500 block">تقييمك الإجمالي</label>
        <div className="flex items-center justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="p-1 text-amber-400 hover:scale-110 transition-transform"
            >
              <Star
                className="size-7"
                fill={star <= rating ? "currentColor" : "none"}
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">اسمك الكريم *</label>
        <input
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-slate-900"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="مثال: أحمد محمد"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">رأيك وتجربتك في المنتج</label>
        <textarea
          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 leading-relaxed"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="احكيلنا عن خامة المنتج، مطابقة الصورة، وتوصيل المندوب..."
        />
      </div>

      {/* تسجيل الفويس نوت الحي */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Mic className="size-3.5 text-emerald-600" />
            <span>تسجيل فويس نوت برأيك (اختياري)</span>
          </span>
          {audioDuration > 0 && (
            <span className="text-xs font-mono font-bold text-slate-700">
              00:{audioDuration < 10 ? `0${audioDuration}` : audioDuration}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          {!recording && !audioBlob && (
            <button
              type="button"
              onClick={startRecording}
              className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-colors"
            >
              <Mic className="size-3.5" />
              <span>اضغط للتسجيل الصوتي</span>
            </button>
          )}

          {recording && (
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs animate-pulse transition-colors"
            >
              <Square className="size-3.5" />
              <span>إيقاف التسجيل</span>
            </button>
          )}

          {audioBlob && !recording && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg flex items-center gap-1">
                <Volume2 className="size-3.5" /> تم تسجيل الصوت بنجاح
              </span>
              <button
                type="button"
                onClick={resetRecording}
                className="text-xs text-slate-500 hover:text-red-600 p-1"
                title="إعادة التسجيل"
              >
                <RotateCcw className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3 rounded-xl text-xs transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-40"
      >
        {submitting && <Loader2 className="size-3.5 animate-spin" />}
        <span>{submitting ? "جاري رفع التقييم..." : "إرسال التقييم للمتجر"}</span>
      </button>
    </form>
  );
}