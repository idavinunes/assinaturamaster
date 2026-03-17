"use client";

import {
  Camera,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  MapPinned,
  PenLine,
  RefreshCcw,
  Router,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type RequestStatus = "DRAFT" | "SENT" | "OPENED" | "SIGNED" | "EXPIRED" | "CANCELED";

type PublicSignatureEvidencePanelProps = {
  publicToken: string;
  signerName: string;
  requestTitle: string;
  requestStatus: RequestStatus;
  previewUrl?: string | null;
  signedDocumentUrl?: string | null;
  captureDisabled?: boolean;
  initialEvidence?: {
    ipAddress: string;
    latitude: number | null;
    longitude: number | null;
    gpsAccuracyMeters: number | null;
    locationAddress: string | null;
    selfieCapturedAt: string | null;
    selfieUrl: string | null;
    signatureDrawnUrl: string | null;
    signedAtBrowser: string | null;
    capturedAt: string;
  } | null;
};

type LocationState = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
};

type PersistedEvidencePayload = {
  ipAddress?: string;
  latitude?: number | null;
  longitude?: number | null;
  gpsAccuracyMeters?: number | null;
  locationAddress?: string | null;
  selfieCapturedAt?: string | null;
  selfieUrl?: string | null;
  capturedAt?: string;
  error?: string;
};

type FinalizePayload = {
  status?: RequestStatus;
  signedAt?: string;
  signatureUrl?: string;
  signedDocumentUrl?: string;
  error?: string;
};

type SigningStep = "idle" | "selfie" | "location" | "signature" | "done";

const actionableSteps = [
  "Confirmacao de identidade",
  "Confirmacao de localizacao",
  "Assinatura eletronica",
] as const;

function buildInitialLocation(
  initialEvidence: PublicSignatureEvidencePanelProps["initialEvidence"],
) {
  if (
    initialEvidence?.latitude === null ||
    initialEvidence?.latitude === undefined ||
    initialEvidence?.longitude === null ||
    initialEvidence?.longitude === undefined
  ) {
    return null;
  }

  return {
    latitude: initialEvidence.latitude,
    longitude: initialEvidence.longitude,
    accuracy: initialEvidence.gpsAccuracyMeters ?? 0,
    capturedAt: initialEvidence.capturedAt,
  };
}

function buildInitialSigningStep(
  initialEvidence: PublicSignatureEvidencePanelProps["initialEvidence"],
) {
  if (initialEvidence?.signedAtBrowser) {
    return "done" satisfies SigningStep;
  }

  if (initialEvidence?.signatureDrawnUrl) {
    return "signature" satisfies SigningStep;
  }

  if (
    initialEvidence?.selfieUrl &&
    initialEvidence?.latitude !== null &&
    initialEvidence?.latitude !== undefined &&
    initialEvidence?.longitude !== null &&
    initialEvidence?.longitude !== undefined
  ) {
    return "signature" satisfies SigningStep;
  }

  if (initialEvidence?.selfieUrl) {
    return "location" satisfies SigningStep;
  }

  return "idle" satisfies SigningStep;
}

function getCanvasPoint(
  event: ReactPointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
) {
  return getCanvasPointFromClientPosition(event.clientX, event.clientY, canvas);
}

function getCanvasPointFromClientPosition(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

export function PublicSignatureEvidencePanel({
  publicToken,
  signerName,
  requestTitle,
  requestStatus,
  previewUrl = null,
  signedDocumentUrl = null,
  captureDisabled = false,
  initialEvidence = null,
}: PublicSignatureEvidencePanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const selfieCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const finalizeLockRef = useRef(false);
  const signatureHasDrawnRef = useRef(Boolean(initialEvidence?.signatureDrawnUrl));

  const initialLocation = buildInitialLocation(initialEvidence);
  const [signingStep, setSigningStep] = useState<SigningStep>(
    buildInitialSigningStep(initialEvidence),
  );
  const [ip, setIp] = useState(
    initialEvidence?.ipAddress ?? (captureDisabled ? "indisponivel" : "carregando..."),
  );
  const [ipCapturedAt, setIpCapturedAt] = useState(initialEvidence?.capturedAt ?? null);
  const [location, setLocation] = useState<LocationState | null>(initialLocation);
  const [locationAddress, setLocationAddress] = useState<string | null>(
    initialEvidence?.locationAddress ?? null,
  );
  const [locationError, setLocationError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [locationPending, setLocationPending] = useState(false);
  const [addressPending, setAddressPending] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [activationPending, setActivationPending] = useState(false);
  const [selfiePending, setSelfiePending] = useState(false);
  const [selfieDraftUrl, setSelfieDraftUrl] = useState<string | null>(null);
  const [selfieDraftCapturedAt, setSelfieDraftCapturedAt] = useState<string | null>(null);
  const [selfiePreviewUrl, setSelfiePreviewUrl] = useState<string | null>(
    initialEvidence?.selfieUrl ?? null,
  );
  const [selfieCapturedAt, setSelfieCapturedAt] = useState<string | null>(
    initialEvidence?.selfieCapturedAt ?? null,
  );
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const [signatureHasDrawn, setSignatureHasDrawn] = useState(
    Boolean(initialEvidence?.signatureDrawnUrl),
  );
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(
    initialEvidence?.signatureDrawnUrl ?? null,
  );
  const [signedAtBrowser, setSignedAtBrowser] = useState<string | null>(
    initialEvidence?.signedAtBrowser ?? null,
  );
  const [completedSignedDocumentUrl, setCompletedSignedDocumentUrl] = useState<string | null>(
    signedDocumentUrl,
  );
  const [finalizePending, setFinalizePending] = useState(false);

  const isSigned = requestStatus === "SIGNED" || signedAtBrowser !== null;
  const isBlocked = requestStatus === "EXPIRED" || requestStatus === "CANCELED";
  const activeSignedDocumentUrl = completedSignedDocumentUrl ?? signedDocumentUrl;
  const canFinalize =
    signatureHasDrawn &&
    Boolean(location) &&
    Boolean(selfiePreviewUrl) &&
    !finalizePending &&
    !locationPending &&
    !addressPending &&
    !selfiePending;

  function configureSignatureCanvas(signatureImageUrl?: string | null) {
    const canvas = signatureCanvasRef.current;

    if (!canvas) {
      return null;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || 720;
    const cssHeight = canvas.clientHeight || 220;

    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#18211d";
    context.lineWidth = 3.2;
    context.imageSmoothingEnabled = true;

    if (signatureImageUrl) {
      const image = new window.Image();
      image.onload = () => {
        context.drawImage(image, 0, 0, cssWidth, cssHeight);
      };
      image.src = signatureImageUrl;
    }

    return {
      canvas,
      context,
    };
  }

  function stopCameraStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraReady(false);
  }

  async function persistEvidence(payload?: {
    latitude?: number;
    longitude?: number;
    gpsAccuracyMeters?: number;
    locationAddress?: string;
    selfieBase64?: string;
    selfieCapturedAt?: string;
  }) {
    const response = await fetch(`/api/public-signature/${publicToken}/evidence`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload ?? {}),
    });

    const body = (await response.json()) as PersistedEvidencePayload;

    if (!response.ok) {
      throw new Error(body.error ?? "Nao foi possivel salvar a evidencia.");
    }

    setIp(body.ipAddress ?? "indisponivel");
    setIpCapturedAt(body.capturedAt ?? null);
    setLocationAddress(body.locationAddress ?? null);
    setSelfieCapturedAt(body.selfieCapturedAt ?? null);

    if (body.selfieUrl) {
      setSelfiePreviewUrl(body.selfieUrl);
    }

    if (body.latitude !== null && body.latitude !== undefined) {
      setLocation({
        latitude: body.latitude,
        longitude: body.longitude ?? 0,
        accuracy: body.gpsAccuracyMeters ?? 0,
        capturedAt: body.capturedAt ?? new Date().toISOString(),
      });
    }
  }

  useEffect(() => {
    if (captureDisabled) {
      return;
    }

    let active = true;

    async function registerIpOnOpen() {
      try {
        const response = await fetch(`/api/public-signature/${publicToken}/evidence`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: "{}",
        });

        const body = (await response.json()) as PersistedEvidencePayload;

        if (!active) {
          return;
        }

        if (!response.ok) {
          throw new Error(body.error ?? "Nao foi possivel salvar a evidencia.");
        }

        setIp(body.ipAddress ?? "indisponivel");
        setIpCapturedAt(body.capturedAt ?? null);
      } catch (error) {
        if (!active) {
          return;
        }

        setIp("indisponivel");
        setAddressError(
          error instanceof Error ? error.message : "Nao foi possivel registrar o IP.",
        );
      }
    }

    registerIpOnOpen();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [captureDisabled, publicToken]);

  useEffect(() => {
    configureSignatureCanvas(
      signingStep === "signature" ? signaturePreviewUrl : null,
    );
  }, [signaturePreviewUrl, signingStep]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  async function startCamera() {
    if (captureDisabled || isBlocked || isSigned) {
      return false;
    }

    try {
      setCameraError(null);
      setCameraReady(false);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraReady(true);
      return true;
    } catch {
      setCameraReady(false);
      setCameraError(
        "Nao foi possivel acessar a camera. Em celular, use HTTPS ou localhost.",
      );
      return false;
    }
  }

  async function captureLocation() {
    if (captureDisabled || isBlocked || isSigned) {
      return false;
    }

    if (!navigator.geolocation) {
      setLocationError("Geolocalizacao nao disponivel neste navegador.");
      return false;
    }

    setLocationPending(true);
    setLocationError(null);
    setAddressError(null);

    return await new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const nextLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            capturedAt: new Date().toISOString(),
          };

          setLocation(nextLocation);
          setLocationPending(false);
          setAddressPending(true);

          try {
            let resolvedAddress: string | undefined;
            const response = await fetch(
              `/api/network/reverse-geocode?lat=${nextLocation.latitude}&lng=${nextLocation.longitude}`,
            );

            const payload = (await response.json()) as {
              address?: string | null;
              error?: string;
            };

            if (!response.ok) {
              setAddressError(payload.error ?? "Endereco indisponivel.");
            } else if (payload.address) {
              resolvedAddress = payload.address;
            }

            await persistEvidence({
              latitude: nextLocation.latitude,
              longitude: nextLocation.longitude,
              gpsAccuracyMeters: nextLocation.accuracy,
              ...(resolvedAddress ? { locationAddress: resolvedAddress } : {}),
            });
          } catch (error) {
            setAddressError(
              error instanceof Error
                ? error.message
                : "Nao foi possivel salvar a evidencia.",
            );
          } finally {
            setAddressPending(false);
            resolve(true);
          }
        },
        (error) => {
          setLocationPending(false);
          setLocationError(error.message);
          resolve(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        },
      );
    });
  }

  async function takeSelfie() {
    if (captureDisabled || !videoRef.current || !selfieCanvasRef.current) {
      return;
    }

    const canvas = selfieCanvasRef.current;
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      setCameraError("Nao foi possivel capturar a selfie.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const capturedAt = new Date().toISOString();
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    setCameraError(null);
    setSelfieDraftUrl(dataUrl);
    setSelfieDraftCapturedAt(capturedAt);
  }

  async function confirmSelfie() {
    if (!selfieDraftUrl || !selfieDraftCapturedAt) {
      return;
    }

    setSelfiePending(true);
    setCameraError(null);

    try {
      await persistEvidence({
        selfieBase64: selfieDraftUrl,
        selfieCapturedAt: selfieDraftCapturedAt,
      });
      setSelfiePreviewUrl(selfieDraftUrl);
      setSelfieCapturedAt(selfieDraftCapturedAt);
      setSelfieDraftUrl(null);
      setSelfieDraftCapturedAt(null);
      stopCameraStream();
      setSigningStep(location ? "signature" : "location");
    } catch (error) {
      setCameraError(
        error instanceof Error ? error.message : "Nao foi possivel salvar a selfie.",
      );
    } finally {
      setSelfiePending(false);
    }
  }

  async function retakeSelfie() {
    setSelfieDraftUrl(null);
    setSelfieDraftCapturedAt(null);

    if (!cameraReady) {
      await startCamera();
    }
  }

  async function beginSigningFlow() {
    if (captureDisabled || isBlocked || isSigned) {
      return;
    }

    setActivationPending(true);
    setSignatureError(null);

    try {
      if (selfiePreviewUrl) {
        setSigningStep(location ? "signature" : "location");
        return;
      }

      setSigningStep("selfie");
      await startCamera();
    } finally {
      setActivationPending(false);
    }
  }

  async function continueFromLocationStep() {
    if (location) {
      setSigningStep("signature");
      return;
    }

    const didCaptureLocation = await captureLocation();

    if (didCaptureLocation) {
      setSigningStep("signature");
    }
  }

  function beginDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const point = getCanvasPoint(event, canvas);
    context.beginPath();
    context.arc(point.x, point.y, 1.2, 0, Math.PI * 2);
    context.fillStyle = "#18211d";
    context.fill();
    context.beginPath();
    context.moveTo(point.x, point.y);
    isDrawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    signatureHasDrawnRef.current = true;
    setSignatureHasDrawn(true);
    setSignatureError(null);
  }

  function continueDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    if (!isDrawingRef.current) {
      return;
    }

    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const pointerEvents =
      typeof event.nativeEvent.getCoalescedEvents === "function"
        ? event.nativeEvent.getCoalescedEvents()
        : [event.nativeEvent];

    for (const pointerEvent of pointerEvents) {
      const point = getCanvasPointFromClientPosition(
        pointerEvent.clientX,
        pointerEvent.clientY,
        canvas,
      );
      context.lineTo(point.x, point.y);
    }

    context.stroke();
    signatureHasDrawnRef.current = true;
    setSignatureHasDrawn(true);
  }

  function endDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    if (!isDrawingRef.current) {
      return;
    }

    isDrawingRef.current = false;
    signatureCanvasRef.current?.getContext("2d")?.closePath();
    setSignaturePreviewUrl(signatureCanvasRef.current?.toDataURL("image/png") ?? null);
    signatureCanvasRef.current?.releasePointerCapture(event.pointerId);
  }

  function clearSignature() {
    const configuredCanvas = configureSignatureCanvas(null);

    if (!configuredCanvas) {
      return;
    }

    signatureHasDrawnRef.current = false;
    setSignatureHasDrawn(false);
    setSignaturePreviewUrl(null);
    setSignatureError(null);
  }

  async function finalizeSignature() {
    if (finalizeLockRef.current || isBlocked || isSigned) {
      return;
    }

    const signatureBase64 = signatureCanvasRef.current?.toDataURL("image/png");

    if (!signatureBase64 || !signatureHasDrawnRef.current) {
      setSignatureError("Desenhe sua assinatura antes de finalizar.");
      return;
    }

    if (!location || !selfiePreviewUrl) {
      setSignatureError(
        "Para finalizar, a assinatura desenhada, o GPS e a selfie precisam estar capturados.",
      );
      return;
    }

    finalizeLockRef.current = true;
    setFinalizePending(true);
    setSignatureError(null);

    try {
      const response = await fetch(`/api/public-signature/${publicToken}/sign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signatureBase64,
          signedAtBrowser: new Date().toISOString(),
          termsAccepted: true,
          termsVersion: "mvp-v1",
        }),
      });

      const payload = (await response.json()) as FinalizePayload;

      if (!response.ok) {
        throw new Error(payload.error ?? "Nao foi possivel finalizar a assinatura.");
      }

      setSignedAtBrowser(payload.signedAt ?? new Date().toISOString());
      setCompletedSignedDocumentUrl(payload.signedDocumentUrl ?? signedDocumentUrl);
      stopCameraStream();
      setSigningStep("done");
    } catch (error) {
      setSignatureError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel finalizar a assinatura.",
      );
    } finally {
      finalizeLockRef.current = false;
      setFinalizePending(false);
    }
  }

  const remainingSteps = [
    !selfiePreviewUrl ? "selfie" : null,
    !location ? "localizacao" : null,
    !signatureHasDrawn ? "assinatura" : null,
  ].filter(Boolean) as string[];
  const currentActionStepIndex =
    signingStep === "selfie"
      ? 0
      : signingStep === "location"
        ? 1
        : signingStep === "signature"
          ? 2
          : 0;
  const currentActionStepLabel = actionableSteps[currentActionStepIndex];
  const progressValue =
    signingStep === "done" || isSigned ? 100 : ((currentActionStepIndex + 1) / actionableSteps.length) * 100;

  return (
    <section className="grid gap-4">
      <div className="rounded-[32px] border border-slate-200 bg-[#eef3ff] px-5 py-6 shadow-sm md:px-8 md:py-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[clamp(1.9rem,4vw,3.15rem)] font-bold tracking-tight text-[#1d4ed8]">
            Ola, {signerName}!
          </p>
          <p className="mt-3 text-lg leading-8 text-slate-600">
            Estamos quase la. Siga os passos para finalizar a assinatura do seu documento.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Documento: {requestTitle}
          </p>

          <div className="mt-8 h-2 overflow-hidden rounded-full bg-[#cfe0ff]">
            <div
              className="h-full rounded-full bg-[#8fb4f2] transition-[width] duration-300"
              style={{ width: `${progressValue}%` }}
            />
          </div>

          <p className="mt-3 text-sm font-medium text-slate-500">
            {isSigned || signingStep === "done"
              ? "Assinatura concluida"
              : `Passo ${currentActionStepIndex + 1} de ${actionableSteps.length}: ${currentActionStepLabel}`}
          </p>
        </div>
      </div>

      {isBlocked ? (
        <div className="rounded-[28px] border border-stone-300 bg-stone-100 px-5 py-5 text-sm text-stone-700">
          Este link esta bloqueado para nova assinatura.
        </div>
      ) : null}

      {previewUrl && !isSigned ? (
        <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow text-slate-400">Leitura opcional</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                Quer revisar o contrato antes de assinar?
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Abra a previa em modo leitura, confira o texto e volte para continuar a
                assinatura normalmente.
              </p>
            </div>

            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ExternalLink className="size-4" />
              Ver previa do contrato
            </a>
          </div>
        </div>
      ) : null}

      {!isSigned && !isBlocked && signingStep === "idle" ? (
        <div className="rounded-[32px] border border-slate-200 bg-white px-5 py-6 shadow-sm md:px-6 md:py-7">
          <p className="text-2xl font-semibold tracking-tight text-slate-900">
            Vamos comecar
          </p>
          <p className="mt-3 text-base leading-7 text-slate-600">
            O processo tem 3 etapas simples: confirmar sua foto, confirmar sua localizacao e desenhar sua assinatura.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {actionableSteps.map((stepLabel, index) => (
              <div
                key={stepLabel}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left"
              >
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                  Etapa {index + 1}
                </p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {stepLabel}
                </p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void beginSigningFlow()}
            disabled={activationPending || finalizePending}
            className="button-primary mt-7 w-full justify-center text-base"
          >
            {activationPending ? (
              <LoaderCircle className="size-5 animate-spin" />
            ) : (
              <PenLine className="size-5" />
            )}
            {activationPending ? "Preparando camera" : "Comecar assinatura"}
          </button>
        </div>
      ) : null}

      {signingStep === "selfie" && !isSigned ? (
        <div className="rounded-[32px] border border-slate-200 bg-white px-5 py-6 shadow-sm md:px-6 md:py-7">
          <div className="flex items-start gap-3">
            <Camera className="mt-1 size-6 text-[#2563eb]" />
            <div>
              <h2 className="text-[2rem] font-bold tracking-tight text-slate-900">
                1. Confirmacao de identidade
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Para sua seguranca, precisamos de uma foto sua. Certifique-se de que seu rosto esteja claro e bem iluminado.
              </p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[26px] bg-slate-200">
            {selfieDraftUrl ? (
              <Image
                unoptimized
                src={selfieDraftUrl}
                alt="Selfie de evidencia do signatario"
                width={1200}
                height={900}
                className="aspect-[16/10] w-full object-cover"
              />
            ) : (
              <video
                ref={videoRef}
                className={`aspect-[16/10] w-full object-cover ${cameraReady ? "block" : "hidden"}`}
                muted
                playsInline
                autoPlay
              />
            )}
            {!cameraReady && !selfieDraftUrl ? (
              <div className="flex aspect-[16/10] w-full items-center justify-center px-6 text-center text-base text-slate-500">
                Area da camera para capturar sua selfie
              </div>
            ) : null}
          </div>

          <canvas ref={selfieCanvasRef} className="hidden" />

          <div className="mt-6 flex flex-col gap-3">
            {!cameraReady && !selfieDraftUrl ? (
              <button
                type="button"
                onClick={() => void startCamera()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-4 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Camera className="size-5" />
                Liberar camera novamente
              </button>
            ) : null}

            {!selfieDraftUrl ? (
              <button
                type="button"
                onClick={() => void takeSelfie()}
                disabled={!cameraReady || selfiePending || finalizePending}
                className="button-primary w-full justify-center text-base disabled:opacity-60"
              >
                {selfiePending ? (
                  <LoaderCircle className="size-5 animate-spin" />
                ) : (
                  <Camera className="size-5" />
                )}
                Tirar foto
              </button>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void confirmSelfie()}
                  disabled={selfiePending}
                  className="button-primary w-full justify-center text-base disabled:opacity-60 sm:flex-1"
                >
                  {selfiePending ? (
                    <LoaderCircle className="size-5 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-5" />
                  )}
                  {selfiePending ? "Confirmando foto" : "Confirmar foto e seguir"}
                </button>

                <button
                  type="button"
                  onClick={() => void retakeSelfie()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-4 text-base font-semibold text-slate-700 transition hover:bg-slate-50 sm:flex-1"
                >
                  <RefreshCcw className="size-5" />
                  Refazer foto
                </button>
              </div>
            )}
          </div>

          {cameraError ? (
            <p className="mt-4 text-sm text-red-700">{cameraError}</p>
          ) : null}

          {selfieDraftUrl && selfieDraftCapturedAt ? (
            <p className="mt-4 text-sm text-slate-500">
              Foto capturada em {new Date(selfieDraftCapturedAt).toLocaleString("pt-BR")}
            </p>
          ) : null}
        </div>
      ) : null}

      {signingStep === "location" && !isSigned ? (
        <div className="rounded-[32px] border border-slate-200 bg-white px-5 py-6 shadow-sm md:px-6 md:py-7">
          <div className="flex items-start gap-3">
            <MapPinned className="mt-1 size-6 text-[#2563eb]" />
            <div>
              <h2 className="text-[2rem] font-bold tracking-tight text-slate-900">
                2. Confirmacao de localizacao
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Para concluir a assinatura com seguranca, precisamos registrar sua localizacao atual. Toque no botao abaixo para continuar.
              </p>
            </div>
          </div>

          {selfiePreviewUrl ? (
            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Foto confirmada
              </p>
              <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start">
                <Image
                  unoptimized
                  src={selfiePreviewUrl}
                  alt="Selfie confirmada do signatario"
                  width={900}
                  height={680}
                  className="aspect-[4/3] w-full max-w-[240px] rounded-[18px] object-cover"
                />
                <div className="text-sm leading-6 text-slate-500">
                  <p>Sua foto ja foi confirmada e esta pronta para o registro final.</p>
                  {selfieCapturedAt ? (
                    <p className="mt-2">
                      Capturada em {new Date(selfieCapturedAt).toLocaleString("pt-BR")}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-6 rounded-[26px] bg-slate-100 px-6 py-10 text-center">
            {location ? (
              <div className="mx-auto max-w-xl text-left text-base leading-7 text-slate-600">
                <p className="font-semibold text-slate-900">Localizacao confirmada</p>
                <p className="mt-3">Latitude: {location.latitude.toFixed(6)}</p>
                <p>Longitude: {location.longitude.toFixed(6)}</p>
                <p>Precisao: {location.accuracy.toFixed(2)} metros</p>
                <p>Registrado em {new Date(location.capturedAt).toLocaleString("pt-BR")}</p>
                {locationAddress ? (
                  <p className="mt-3 text-slate-700">{locationAddress}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-base text-slate-500">
                Seu navegador vai pedir permissao para confirmar sua localizacao.
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void continueFromLocationStep()}
              disabled={locationPending || addressPending}
              className="button-primary w-full justify-center text-base disabled:opacity-60"
            >
              {locationPending || addressPending ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : (
                <MapPinned className="size-5" />
              )}
              {location
                ? "Localizacao confirmada, seguir para assinatura"
                : "Permitir localizacao"}
            </button>

            {!location && !locationPending && !addressPending ? (
              <button
                type="button"
                onClick={() => void continueFromLocationStep()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-4 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCcw className="size-5" />
                Tentar novamente
              </button>
            ) : null}
          </div>

          {locationError ? (
            <p className="mt-4 text-sm text-red-700">{locationError}</p>
          ) : null}

          {addressError ? (
            <p className="mt-4 text-sm text-amber-700">{addressError}</p>
          ) : null}
        </div>
      ) : null}

      {signingStep === "signature" && !isSigned ? (
        <div className="rounded-[32px] border border-slate-200 bg-white px-5 py-6 shadow-sm md:px-6 md:py-7">
          <div className="flex items-start gap-3">
            <PenLine className="mt-1 size-6 text-[#2563eb]" />
            <div>
              <h2 className="text-[2rem] font-bold tracking-tight text-slate-900">
                3. Assine o documento
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Use o dedo, o mouse ou uma caneta para desenhar sua assinatura no campo abaixo.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {selfiePreviewUrl ? (
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Foto confirmada
                </p>
                <Image
                  unoptimized
                  src={selfiePreviewUrl}
                  alt="Selfie confirmada do signatario"
                  width={900}
                  height={680}
                  className="mt-3 aspect-[4/3] w-full rounded-[18px] object-cover"
                />
              </div>
            ) : null}

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Localizacao registrada
              </p>
              {location ? (
                <div className="mt-3 text-sm leading-6 text-slate-600">
                  <p>Latitude: {location.latitude.toFixed(6)}</p>
                  <p>Longitude: {location.longitude.toFixed(6)}</p>
                  <p>Precisao: {location.accuracy.toFixed(2)} metros</p>
                  {locationAddress ? (
                    <p className="mt-2 text-slate-700">{locationAddress}</p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  Aguardando confirmacao de localizacao.
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[26px] border border-dashed border-slate-300 bg-slate-100">
            <canvas
              ref={signatureCanvasRef}
              className="h-[240px] w-full touch-none select-none bg-transparent sm:h-[280px]"
              onPointerDown={beginDrawing}
              onPointerMove={continueDrawing}
              onPointerUp={endDrawing}
              onPointerLeave={endDrawing}
              onPointerCancel={endDrawing}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
              <PenLine className="size-4" />
              {signatureHasDrawn ? "Assinatura registrada" : "Aguardando assinatura"}
            </div>

            {remainingSteps.length > 0 ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
                <ShieldCheck className="size-4" />
                Faltam: {remainingSteps.join(", ")}
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={clearSignature}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-4 text-base font-semibold text-slate-700 transition hover:bg-slate-50 sm:flex-1"
            >
              <RefreshCcw className="size-5" />
              Limpar assinatura
            </button>

            <button
              type="button"
              onClick={() => void finalizeSignature()}
              disabled={!canFinalize}
              className="button-primary w-full justify-center text-base disabled:opacity-60 sm:flex-1"
            >
              {finalizePending ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : (
                <ShieldCheck className="size-5" />
              )}
              {finalizePending ? "Finalizando assinatura" : "Finalizar assinatura"}
            </button>
          </div>

          {signatureError ? (
            <p className="mt-4 text-sm text-red-700">{signatureError}</p>
          ) : null}
        </div>
      ) : null}

      {isSigned ? (
        <div className="rounded-[32px] border border-emerald-200 bg-emerald-50 px-5 py-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto size-16 text-emerald-600" />
          <p className="mt-4 text-2xl font-bold tracking-tight text-emerald-800">
            Assinatura concluida
          </p>
          <p className="mt-3 text-base leading-7 text-emerald-700">
            Obrigado. O documento foi finalizado com sucesso.
          </p>
          {signedAtBrowser ? (
            <p className="mt-3 text-sm text-emerald-700">
              Finalizada em {new Date(signedAtBrowser).toLocaleString("pt-BR")}
            </p>
          ) : null}
          {activeSignedDocumentUrl ? (
            <div className="mt-6">
              <a
                href={activeSignedDocumentUrl}
                target="_blank"
                rel="noreferrer"
                className="button-primary"
              >
                <ExternalLink className="size-5" />
                Ver PDF assinado
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      {signingStep !== "idle" && signingStep !== "done" && !isSigned ? (
        <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
          <button
            type="button"
            onClick={() => void beginSigningFlow()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-4 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCcw className="size-5" />
            Reabrir fluxo de assinatura
          </button>
        </div>
      ) : null}

      <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
        <div className="flex items-center gap-2 text-slate-700">
          <Router className="size-4 text-slate-400" />
          <span className="font-medium">Informacoes tecnicas</span>
        </div>
        <p className="mt-2 font-mono text-sm text-slate-500">{ip}</p>
        {ipCapturedAt ? (
          <p className="mt-2 text-xs text-slate-400">
            Registrado em {new Date(ipCapturedAt).toLocaleString("pt-BR")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
