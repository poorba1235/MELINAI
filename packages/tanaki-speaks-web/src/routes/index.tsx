import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@/components/ClientOnly";
import { Suspense, lazy } from "react";
import Lottie from "lottie-react";
import loadingAnimation from "@/../public/loading.json";

export const Route = createFileRoute("/")({ component: TanakiRoute });

const TanakiClient = lazy(() => import("@/components/TanakiClient"));

function TanakiRoute() {
  return (
    <ClientOnly
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
          <p className="font-mono text-sm">Loading…</p>
        </div>
      }
    >
      <Suspense
        fallback={
           <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-[1000] text-center">
             <Lottie 
                     animationData={loadingAnimation} 
                     className="w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] lg:w-[600px] lg:h-[600px]" 
                   />
         
                   <p className="hidden text-xs text-gray-600 max-w-[80%] mt-4 md:block md:hidden">
                     For the best experience, we recommend using App on a desktop device.
                     Mobile compatibility is currently limited.
                   </p>
                 </div>
        }>
        <TanakiClient />
      </Suspense>
    </ClientOnly>
  );
}
