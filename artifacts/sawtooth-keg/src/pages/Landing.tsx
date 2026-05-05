import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { ArrowRight, Beer } from "lucide-react";

export default function Landing() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="min-h-[100dvh] flex flex-col bg-stone-50">
      <Navbar />
      
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 relative overflow-hidden">
        {/* Abstract mountain/nature shapes behind */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden flex justify-center items-center opacity-[0.03]">
          <div className="w-[800px] h-[800px] bg-primary rounded-full blur-[100px] mix-blend-multiply translate-x-1/3 -translate-y-1/4"></div>
          <div className="w-[600px] h-[600px] bg-amber-600 rounded-full blur-[100px] mix-blend-multiply -translate-x-1/3 translate-y-1/4"></div>
        </div>

        <div className="z-10 max-w-3xl w-full flex flex-col items-center">
          <div className="mb-8 p-4 bg-white/50 backdrop-blur-sm rounded-full border shadow-sm">
            <img src={`${basePath}/logo.svg`} alt="Sawtooth Logo" className="h-16 w-16" />
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold font-serif text-stone-900 tracking-tight mb-6">
            Sawtooth Brewery
          </h1>
          <p className="text-xl md:text-2xl text-stone-600 mb-10 max-w-2xl font-light">
            Honest beer from the Mountain West. Reserve a keg for your next gathering, picked up fresh from our taproom.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <Link href="/keg-order" className="w-full sm:w-auto">
              <Button size="lg" className="w-full text-lg h-14 px-8 rounded-full shadow-lg hover:shadow-xl transition-all hover:-translate-y-1" data-testid="link-hero-order">
                Order a Keg
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            
            <Link href="/sign-in" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full text-lg h-14 px-8 rounded-full bg-white border-stone-300 hover:bg-stone-100" data-testid="link-hero-staff">
                Staff Access
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full text-left z-10">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
            <div className="h-12 w-12 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center mb-4">
              <Beer className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-stone-900 mb-2 font-serif">Fresh from the Source</h3>
            <p className="text-stone-600">Reserve any of our core beers or seasonal rotators in 1/6 BBL or 1/2 BBL sizes.</p>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
            <div className="h-12 w-12 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar-clock"><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h5"/><path d="M17.5 17.5 16 16.3V14"/><circle cx="16" cy="16" r="6"/></svg>
            </div>
            <h3 className="text-lg font-bold text-stone-900 mb-2 font-serif">Easy Scheduling</h3>
            <p className="text-stone-600">Choose your pickup date and time. We'll have your keg chilled and ready to go.</p>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
            <div className="h-12 w-12 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-party-popper"><path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.31-1.82.2-1.98 1.11v0c-.11.7-.72 1.22-1.43 1.22H17c-.86 0-1.56.62-1.72 1.44l-.28 1.56"/><path d="m15 5-.5-.5c-.93-.93-2.29-.96-3.27-.08l-3.3 2.95c-.88.88-2.24.85-3.17-.08v0C3.76 6.3 2.4 6.27 1.52 7.15l-3.3 2.95"/></svg>
            </div>
            <h3 className="text-lg font-bold text-stone-900 mb-2 font-serif">Everything You Need</h3>
            <p className="text-stone-600">Rent party taps, CO2 tanks, and tubs right here. A $30 deposit holds your gear.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
