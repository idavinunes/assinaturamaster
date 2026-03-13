"use client";

import { Camera, MapPinned, RefreshCcw, Router, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type LocationState = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export default function EvidenceCollectionDemoPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [ip, setIp] = useState("carregando...");
  const [location, setLocation] = useState<LocationState | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    fetch("/api/network/ip")
      .then((response) => response.json())
      .then((payload) => {
        setIp(payload.ip ?? "indisponivel");
      })
      .catch(() => {
        setIp("indisponivel");
      });
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  async function startCamera() {
    try {
      setCameraError(null);
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
    } catch {
      setCameraError(
        "Nao foi possivel acessar a camera. Em celular, use HTTPS ou localhost.",
      );
    }
  }

  function captureLocation() {
    if (!navigator.geolocation) {
      setLocationError("Geolocalizacao nao disponivel neste navegador.");
      return;
    }

    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        setLocationError(error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  }

  function takeSelfie() {
    if (!videoRef.current || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setSelfieDataUrl(canvas.toDataURL("image/jpeg", 0.92));
  }

  return (
    <main className="px-6 py-8 md:px-10 lg:px-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="panel rounded-[32px] px-6 py-6 md:px-8">
          <Link href="/" className="eyebrow text-muted">
            voltar ao painel
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
            Prova de conceito para selfie, GPS e IP
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted">
            Esta tela valida a parte mais sensivel do fluxo de assinatura.
            Ainda nao grava no banco, mas confirma captura local no navegador.
          </p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="panel rounded-[32px] p-6 md:p-8">
            <div className="flex items-center gap-3">
              <Camera className="size-5 text-accent" />
              <p className="eyebrow text-muted">Camera frontal</p>
            </div>

            <div className="mt-5 overflow-hidden rounded-[28px] border border-line bg-stone-950">
              <video
                ref={videoRef}
                className="aspect-[4/3] w-full object-cover"
                muted
                playsInline
                autoPlay
              />
            </div>

            <canvas ref={canvasRef} className="hidden" />

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={startCamera}
                className="button-primary"
              >
                <Camera className="size-4" />
                Ativar camera
              </button>
              <button
                type="button"
                onClick={takeSelfie}
                disabled={!cameraReady}
                className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCcw className="size-4" />
                Tirar selfie
              </button>
            </div>

            {cameraError ? (
              <p className="mt-4 text-sm text-red-700">{cameraError}</p>
            ) : null}

            {selfieDataUrl ? (
              <div className="mt-6 rounded-[28px] border border-line bg-white/70 p-4">
                <p className="eyebrow text-muted">Selfie capturada</p>
                <Image
                  unoptimized
                  src={selfieDataUrl}
                  alt="Selfie capturada"
                  width={1200}
                  height={900}
                  className="mt-4 aspect-[4/3] w-full rounded-[20px] object-cover"
                />
              </div>
            ) : null}
          </article>

          <article className="panel rounded-[32px] p-6 md:p-8">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-5 text-highlight" />
              <p className="eyebrow text-muted">Metadados capturados</p>
            </div>

            <div className="mt-6 grid gap-4">
              <div className="rounded-[24px] bg-white/70 p-5">
                <div className="flex items-center gap-2">
                  <Router className="size-4 text-accent" />
                  <p className="text-sm font-semibold">IP percebido pelo backend</p>
                </div>
                <p className="mt-2 font-mono text-sm text-muted">{ip}</p>
              </div>

              <div className="rounded-[24px] bg-white/70 p-5">
                <div className="flex items-center gap-2">
                  <MapPinned className="size-4 text-highlight" />
                  <p className="text-sm font-semibold">Geolocalizacao</p>
                </div>
                <button
                  type="button"
                  onClick={captureLocation}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold transition hover:bg-white"
                >
                  <MapPinned className="size-4" />
                  Capturar GPS
                </button>

                {location ? (
                  <div className="mt-4 grid gap-2 text-sm text-muted">
                    <p>Latitude: {location.latitude}</p>
                    <p>Longitude: {location.longitude}</p>
                    <p>Precisao: {location.accuracy.toFixed(2)} metros</p>
                  </div>
                ) : null}

                {locationError ? (
                  <p className="mt-4 text-sm text-red-700">{locationError}</p>
                ) : null}
              </div>

              <div className="rounded-[24px] bg-white/70 p-5 text-sm leading-6 text-muted">
                Para funcionar em ambiente real, esta pagina precisa enviar a
                selfie e as coordenadas para um endpoint autenticado, gravar a
                evidencia vinculada ao link de assinatura e consolidar tudo no
                PDF final.
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
