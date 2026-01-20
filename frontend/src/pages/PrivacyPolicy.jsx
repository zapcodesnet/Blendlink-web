import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacyPolicy() {
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
            <Shield className="w-5 h-5 text-primary" />
            Privacy Policy
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">
            <strong>Effective Date:</strong> January 20, 2026<br />
            <strong>Last Updated:</strong> January 20, 2026
          </p>

          <p className="text-lg mb-6">
            Blendlink operates the Blendlink.net website and the Blendlink mobile application. 
            We are committed to protecting your privacy. This Privacy Policy explains how we collect, 
            use, disclose, and safeguard your information when you use the Services.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4">1. Information We Collect</h2>
          <p>We collect information in the following ways:</p>
          
          <h3 className="text-xl font-semibold mt-6 mb-3">Information You Provide</h3>
          <p>When you create an account, post content, create listings, make purchases/sales in the marketplace, 
          refer users, play games, complete tasks, or contact support, we may collect personal information such as:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Name, email address, phone number</li>
            <li>Shipping/billing address</li>
            <li>Payment information (processed securely via third-party providers)</li>
            <li>Profile photo, username</li>
            <li>Any content you post</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3">Automatically Collected Information</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Device information (IP address, device ID, browser type, OS)</li>
            <li>Location data (if enabled)</li>
            <li>Usage data (pages visited, time spent, interactions like likes/shares/comments)</li>
            <li>Cookies and analytics data</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3">Marketplace & Transaction Data</h3>
          <p>For sales of products, rentals, or services, we collect order details, transaction history, and shipping information.</p>

          <h3 className="text-xl font-semibold mt-6 mb-3">Referral & Rewards Data</h3>
          <p>Referral links, unilevel network structure (Level 1 & 2 referrals), earned real cash (from successful marketplace sales) 
          and BL Coins (virtual play money with no real value) balances.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">2. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Provide and improve the Services (e.g., display your feed, enable marketplace transactions, process referrals and rewards)</li>
            <li>Process payments and payouts (real cash from marketplace sales only; BL Coins are virtual play money and have no cash value)</li>
            <li>Send notifications (likes, comments, shares, referrals, earnings, daily login rewards)</li>
            <li>Personalize content, recommendations, and ads</li>
            <li>Prevent fraud, enforce rules, and comply with legal obligations</li>
            <li>Analyze usage and improve features</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4">3. Sharing Your Information</h2>
          <p>We do not sell your personal information. We may share it with:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Service providers (payment processors, shipping partners, cloud storage, analytics tools like Google Analytics)</li>
            <li>Marketplace sellers/buyers (only necessary details for transactions, e.g., shipping address)</li>
            <li>Legal authorities if required by law</li>
            <li>In case of merger/acquisition</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4">4. BL Coins & Rewards</h2>
          <p className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <strong>Important:</strong> BL Coins are virtual play money in-app currency with no real-world monetary value. 
            They cannot be redeemed for cash, transferred outside the app, or used to trade with other members or users 
            except in-app activities. Real cash earnings from marketplace sales are paid via supported methods and 
            subject to verification/taxes.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4">5. Your Rights & Choices</h2>
          <p>Depending on your location, you may have rights to access, correct, delete, or opt out of certain data uses 
          (e.g., under CCPA/CPRA or GDPR). Contact us at <a href="mailto:virtual@blendlink.net" className="text-primary hover:underline">virtual@blendlink.net</a> to exercise these rights.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">6. Data Security</h2>
          <p>We use reasonable measures (encryption, access controls) to protect your data, but no system is 100% secure.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">7. Children's Privacy</h2>
          <p>The Services are not intended for children under 18. We do not knowingly collect data from children.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">8. Changes to This Policy</h2>
          <p>We may update this policy. Changes will be posted here with updated effective date.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">9. Contact Us</h2>
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
