import React from "react";
import { SignIn } from "@clerk/react";

export default function SignInPage() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-stone-50 px-4 py-12 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex justify-center items-center opacity-[0.02]">
        <div className="w-[1000px] h-[1000px] bg-primary rounded-full blur-[100px] mix-blend-multiply"></div>
      </div>
      
      <div className="relative z-10 w-full max-w-[440px]">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </div>
  );
}
