import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { 
  Users, ShoppingBag, Home, Briefcase, Gamepad2, Gift, 
  Coins, Share2, ChevronRight, Smartphone, Bell, Zap
} from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();

  const features = [
    { icon: Users, title: "Social Network", desc: "Connect with friends, share posts & stories" },
    { icon: ShoppingBag, title: "Marketplace", desc: "Buy & sell items with zero fees" },
    { icon: Home, title: "Property Rentals", desc: "Find your perfect home" },
    { icon: Briefcase, title: "Services", desc: "Hire professionals or offer your skills" },
    { icon: Gamepad2, title: "Games", desc: "Play & win BL Coins" },
    { icon: Gift, title: "Raffles", desc: "Enter contests for big prizes" },
    { icon: Coins, title: "BL Coins", desc: "Earn rewards for every activity" },
    { icon: Share2, title: "Referrals", desc: "Invite friends & earn together" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img 
                src="/blendlink-logo.png" 
                alt="Blendlink" 
                className="h-14 w-auto object-contain"
              />
              <span className="font-bold text-2xl">Blendlink</span>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={() => navigate("/login")}
                data-testid="login-btn"
              >
                Login
              </Button>
              <Button 
                onClick={() => navigate("/register")}
                className="rounded-full"
                data-testid="get-started-btn"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 relative">
          <div className="text-center max-w-3xl mx-auto animate-slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              Your All-in-One Super App
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Social, Shop, Play &<br />
              <span className="bl-coin-text">Earn Rewards</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Connect with friends, buy & sell items, find rentals, hire services, 
              play games, and earn BL Coins — all in one app.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="rounded-full text-lg px-8 shadow-lg shadow-primary/25"
                onClick={() => navigate("/register")}
                data-testid="hero-cta-btn"
              >
                Start Earning Today
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="rounded-full text-lg px-8"
                onClick={() => navigate("/login")}
              >
                I Have an Account
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need</h2>
            <p className="text-muted-foreground text-lg">One app, endless possibilities</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 stagger-children">
            {features.map((feature, i) => (
              <div 
                key={i} 
                className="glass-card p-6 rounded-2xl card-hover"
                data-testid={`feature-${feature.title.toLowerCase().replace(/\s/g, '-')}`}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BL Coins Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-transparent via-primary/5 to-transparent">
        <div className="max-w-5xl mx-auto">
          <div className="glass-card p-8 md:p-12 rounded-3xl">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="w-16 h-16 rounded-2xl bl-coin-gradient flex items-center justify-center mb-6 animate-pulse-glow">
                  <Coins className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Earn <span className="bl-coin-text">BL Coins</span>
                </h2>
                <p className="text-muted-foreground mb-6">
                  Get rewarded for everything you do. Post content, invite friends, 
                  play games, and complete tasks to earn BL Coins you can spend in-app.
                </p>
                <ul className="space-y-3">
                  {[
                    "100 BL Coins welcome bonus",
                    "5 coins daily login reward",
                    "50 coins per Level 1 referral",
                    "25 coins per Level 2 referral"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                        <ChevronRight className="w-4 h-4 text-green-500" />
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative">
                <div className="aspect-square max-w-sm mx-auto bg-gradient-to-br from-primary/20 to-amber-500/20 rounded-3xl flex items-center justify-center">
                  <div className="w-32 h-32 bl-coin-gradient rounded-full flex items-center justify-center shadow-2xl">
                    <span className="text-white font-bold text-4xl">BL</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PWA Section */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-600 text-sm font-medium mb-6">
            <Smartphone className="w-4 h-4" />
            Install as App
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Works Like a Native App
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
            Add Blendlink to your home screen for the best experience. 
            Fast, offline-capable, and always at your fingertips.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted">
              <Bell className="w-4 h-4" />
              <span>Push Notifications</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted">
              <Zap className="w-4 h-4" />
              <span>Instant Loading</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted">
              <Smartphone className="w-4 h-4" />
              <span>Home Screen Icon</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Join?
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Create your free account and start earning BL Coins today.
          </p>
          <Button 
            size="lg" 
            className="rounded-full text-lg px-10 shadow-lg shadow-primary/25"
            onClick={() => navigate("/register")}
            data-testid="bottom-cta-btn"
          >
            Create Free Account
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img 
              src="/blendlink-logo.png" 
              alt="Blendlink" 
              className="h-12 w-auto object-contain"
            />
            <span className="font-semibold text-lg">Blendlink</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2024 Blendlink. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
