import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";
import { X, DollarSign, Send, Image, Video, User } from "lucide-react";
import { offersAPI } from "../services/mediaSalesApi";

export default function OfferModal({ media, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    buyer_name: "",
    buyer_email: "",
    amount: media.fixed_price || "",
    message: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.buyer_name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!form.buyer_email.trim() || !form.buyer_email.includes("@")) {
      toast.error("Please enter a valid email");
      return;
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error("Please enter a valid offer amount");
      return;
    }

    setLoading(true);
    try {
      await offersAPI.create({
        media_id: media.media_id,
        buyer_name: form.buyer_name,
        buyer_email: form.buyer_email,
        amount: parseFloat(form.amount),
        message: form.message,
      });
      
      toast.success("Offer submitted! The seller will review your offer.");
      onSuccess();
    } catch (error) {
      toast.error(error.message || "Failed to submit offer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-lg">Make an Offer</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Media Preview */}
        <div className="p-4 border-b border-border">
          <div className="flex gap-4">
            <div className="w-24 h-24 rounded-lg bg-muted overflow-hidden flex-shrink-0">
              <img 
                src={media.watermarked_url || media.thumbnail_url} 
                alt={media.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {media.media_type === "photo" ? (
                  <Image className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Video className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground capitalize">{media.media_type}</span>
              </div>
              <h3 className="font-semibold truncate">{media.title}</h3>
              {media.seller && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-5 h-5 rounded-full bg-muted overflow-hidden">
                    {media.seller.avatar ? (
                      <img src={media.seller.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-full h-full p-0.5 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{media.seller.name}</span>
                </div>
              )}
              {media.fixed_price && (
                <p className="text-sm text-green-600 font-semibold mt-1">
                  Listed at ${media.fixed_price}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your Name *</Label>
            <Input
              id="name"
              value={form.buyer_name}
              onChange={(e) => setForm({ ...form, buyer_name: e.target.value })}
              placeholder="Enter your name"
              data-testid="offer-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Your Email *</Label>
            <Input
              id="email"
              type="email"
              value={form.buyer_email}
              onChange={(e) => setForm({ ...form, buyer_email: e.target.value })}
              placeholder="your@email.com"
              data-testid="offer-email"
            />
            <p className="text-xs text-muted-foreground">
              We'll send payment and contract details to this email
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Offer Amount (USD) *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                min="1"
                step="0.01"
                className="pl-8"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                data-testid="offer-amount"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea
              id="message"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Tell the seller why you're interested..."
              rows={3}
              data-testid="offer-message"
            />
          </div>

          {/* Info */}
          <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">What happens next?</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Seller reviews and accepts/rejects your offer</li>
              <li>If accepted, you complete payment via Stripe</li>
              <li>Both parties e-sign a copyright transfer contract</li>
              <li>You download the original unwatermarked media</li>
            </ol>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading}
            data-testid="submit-offer"
          >
            {loading ? (
              "Submitting..."
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit Offer
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
