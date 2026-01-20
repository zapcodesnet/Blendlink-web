import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Terms of Service
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">
            <strong>Effective Date:</strong> January 20, 2026<br />
            <strong>Last Updated:</strong> January 20, 2026
          </p>

          <p className="text-lg mb-6">
            These Terms of Service govern your access to and use of Blendlink.net website and mobile app 
            operated by Blendlink. By accessing or using the Services, you agree to these Terms. 
            If you do not agree, do not use the Services.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4">1. Eligibility</h2>
          <p>You must be at least 18 years old (or the minimum age in your country) to use the Services. 
          You must provide accurate information during registration.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">2. User Accounts</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials. 
          You are liable for all activity under your account.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">3. Marketplace</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Users may list and purchase products, rentals, and services.</li>
            <li>Sellers are responsible for accurate listings, fulfillment, and compliance with laws.</li>
            <li>Buyers are responsible for payment and acceptance of items.</li>
            <li>We are not a party to transactions and act only as a platform. Disputes are between users (we may assist via mediation).</li>
            <li>Payments are processed securely via third-party providers. Real cash earnings from sales are subject to verification and applicable taxes.</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4">4. Social Features & Content</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>You may post content, like, comment, share, create pages/events/groups.</li>
            <li>You retain ownership of your content but grant us a worldwide, non-exclusive license to display/host it.</li>
            <li>You agree not to post illegal, harmful, or infringing content. We may remove content or suspend accounts for violations.</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4">5. Games & Tasks</h2>
          <p className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            Games and tasks are for entertainment. Rewards (BL Coins) are virtual and have no real-world value. 
            BL Coins can only be used inside the app and cannot be redeemed for cash or transferred outside the app.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4">6. Referral Program & Rewards</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Unilevel referrals: 3–4% commission on Level 1 referrals and 1–2% on Level 2 referrals from successful marketplace sales (real cash only).</li>
            <li>BL Coins are awarded for actions like posting, liking, sharing, daily login, etc.</li>
            <li>Real cash payouts are subject to minimum thresholds, verification, and tax reporting (you are responsible for taxes).</li>
            <li>We may change or terminate the program at any time.</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4">7. Prohibited Conduct</h2>
          <p>You may not:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Use the Services for illegal activities.</li>
            <li>Manipulate referrals or rewards.</li>
            <li>Spam, harass, or impersonate others.</li>
            <li>Attempt to hack or interfere with the platform.</li>
            <li>Sell or transfer accounts.</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4">8. Intellectual Property</h2>
          <p>All app content (except user content) is owned by us. You may not copy or use it without permission.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">9. Termination</h2>
          <p>We may suspend or terminate your account for violations. You may delete your account anytime.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">10. Disclaimers & Limitation of Liability</h2>
          <p>Services are provided "as is." We are not liable for user transactions, content, or losses (except as required by law). BL Coins have no value.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">11. Governing Law</h2>
          <p>These Terms are governed by the laws of California, USA (without regard to conflict of laws).</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">12. Changes to Terms</h2>
          <p>We may update these Terms. Continued use constitutes acceptance.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">13. Contact Us</h2>
          <p>For questions: <a href="mailto:virtual@blendlink.net" className="text-primary hover:underline">virtual@blendlink.net</a></p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2026 Blendlink. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
