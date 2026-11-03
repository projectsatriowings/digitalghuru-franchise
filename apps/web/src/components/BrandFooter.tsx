import React from 'react';
import { MapPin, Phone, Mail, Facebook, Instagram, Linkedin, Twitter, ExternalLink } from 'lucide-react';
import BRANDING from '../config/branding';

export const BrandFooter: React.FC = () => {
  const { contact } = BRANDING;

  return (
    <footer className="bg-[#0F172A] text-white border-t border-slate-800 mt-auto">
      {/* Campuses Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8 border-b border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <div>
            <h4 className="font-heading text-lg font-bold text-white tracking-wide">
              Our Campuses & Branches
            </h4>
            <p className="text-sm text-slate-400 mt-1">
              Digital Guru Centers with Agency-Style Learning & State-of-the-art Infrastructure
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#006FFF]/20 text-[#38A3FF] border border-[#006FFF]/40">
              <span className="w-2 h-2 rounded-full bg-[#006FFF] animate-pulse"></span>
              Live Centers
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {contact.campuses.map((loc) => (
            <div
              key={loc.name}
              className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 hover:border-[#006FFF]/50 transition-colors"
            >
              <h5 className="font-heading font-semibold text-white text-base flex items-center justify-between">
                <span>{loc.name}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-normal">
                  {loc.city}
                </span>
              </h5>
              <div className="flex items-start gap-2 text-slate-300 text-xs mt-2.5 leading-relaxed">
                <MapPin className="h-4 w-4 shrink-0 text-[#006FFF] mt-0.5" />
                <span>{loc.address}</span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-xs">
                <a
                  href={`tel:${loc.phone.replace(/\s/g, '')}`}
                  className="inline-flex items-center gap-1.5 text-slate-300 hover:text-[#FEDC32] transition-colors"
                >
                  <Phone className="h-3.5 w-3.5 text-[#FEDC32]" />
                  <span>{loc.phone}</span>
                </a>
                <span className="text-slate-500 text-[11px]">9:00 AM - 7:00 PM</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Brand & Collaboration Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Logo & About */}
          <div className="md:col-span-6 space-y-4">
            <div className="flex items-center gap-4">
              <img
                src={BRANDING.logo.full}
                alt="Digital Guru Logo"
                className="h-10 w-auto object-contain bg-white/5 p-1 rounded"
              />
              <span className="text-slate-500 font-bold text-sm">✕</span>
              <div className="text-left">
                <div className="text-xs font-semibold text-white tracking-wider uppercase">
                  {contact.collaboration.partnerName}
                </div>
                <div className="text-[11px] text-slate-400">
                  Academic & Mentorship Partner
                </div>
              </div>
            </div>

            <p className="text-xs md:text-sm text-slate-300 leading-relaxed max-w-lg">
              Digital Guru Franchise Enterprise is proudly built for franchise operators, institutes, faculty, students, and parents. Combining practical digital execution with structured academic excellence.
            </p>

            {/* Social Icons */}
            <div className="flex items-center gap-2.5 pt-1">
              <a
                href={contact.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="h-8 w-8 rounded-lg bg-slate-800/90 flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#1877F2] transition-all"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href={contact.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="h-8 w-8 rounded-lg bg-slate-800/90 flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#E4405F] transition-all"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href={contact.social.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="h-8 w-8 rounded-lg bg-slate-800/90 flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#0A66C2] transition-all"
              >
                <Linkedin className="h-4 w-4" />
              </a>
              <a
                href={contact.social.twitter}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X / Twitter"
                className="h-8 w-8 rounded-lg bg-slate-800/90 flex items-center justify-center text-slate-300 hover:text-white hover:bg-black transition-all"
              >
                <Twitter className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Contact Details */}
          <div className="md:col-span-3 space-y-3">
            <h5 className="font-heading font-semibold text-white text-sm uppercase tracking-wider">
              Contact & Support
            </h5>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#006FFF]" />
                <a href={`mailto:${contact.email}`} className="hover:text-white transition-colors">
                  {contact.email}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-[#FEDC32]" />
                <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="hover:text-white transition-colors">
                  {contact.phone}
                </a>
              </div>
              <div className="pt-2">
                <a
                  href={contact.collaboration.partnerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-[#38A3FF] hover:underline"
                >
                  Visit Jaighurudeva Academy <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Quick Info & System Status */}
          <div className="md:col-span-3 space-y-3 text-xs text-slate-400">
            <h5 className="font-heading font-semibold text-white text-sm uppercase tracking-wider">
              Platform
            </h5>
            <p>Digital Guru Franchise Operating System (FOS) v2.0</p>
            <p>Independent High-Performance Multi-Tenant Architecture</p>
            <div className="pt-2 text-[11px] text-slate-500">
              © {new Date().getFullYear()} Digital Ghuru. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default BrandFooter;

