import React from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { 
  Clock, DollarSign, Gavel, Tag, RefreshCw, Zap, Info
} from "lucide-react";

const DURATION_OPTIONS = [
  { value: "1h", label: "1 Hour" },
  { value: "3h", label: "3 Hours" },
  { value: "6h", label: "6 Hours" },
  { value: "12h", label: "12 Hours" },
  { value: "1d", label: "1 Day" },
  { value: "2d", label: "2 Days" },
  { value: "3d", label: "3 Days" },
  { value: "5d", label: "5 Days" },
  { value: "7d", label: "7 Days" },
];

export default function AuctionSettingsForm({ 
  auctionSettings, 
  setAuctionSettings, 
  fixedPrice, 
  setFixedPrice 
}) {
  const isAuction = auctionSettings?.is_auction || false;

  const handleToggle = (enabled) => {
    setAuctionSettings(prev => ({
      ...prev,
      is_auction: enabled,
      starting_bid: enabled ? (prev?.starting_bid || fixedPrice || "") : prev?.starting_bid
    }));
  };

  const handleChange = (field, value) => {
    setAuctionSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="space-y-4">
      {/* Listing Type Toggle */}
      <div className="p-4 bg-muted/50 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isAuction ? 'bg-amber-500/10' : 'bg-primary/10'}`}>
              {isAuction ? (
                <Gavel className={`w-5 h-5 ${isAuction ? 'text-amber-600' : 'text-primary'}`} />
              ) : (
                <Tag className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <p className="font-medium">{isAuction ? "Auction Listing" : "Fixed Price"}</p>
              <p className="text-xs text-muted-foreground">
                {isAuction ? "Let buyers bid on your item" : "Set a fixed price for immediate purchase"}
              </p>
            </div>
          </div>
          <Switch 
            checked={isAuction}
            onCheckedChange={handleToggle}
            data-testid="auction-toggle"
          />
        </div>
      </div>

      {/* Auction Settings */}
      {isAuction && (
        <div className="space-y-4 p-4 border border-amber-500/20 bg-amber-500/5 rounded-xl">
          <h4 className="font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Gavel className="w-4 h-4" />
            Auction Settings
          </h4>

          {/* Duration */}
          <div>
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Duration *
            </Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {DURATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleChange("duration", opt.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    auctionSettings?.duration === opt.value
                      ? 'bg-amber-500 text-white'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                  data-testid={`duration-${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Starting Bid */}
          <div>
            <Label htmlFor="starting-bid" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Starting Bid *
            </Label>
            <div className="relative mt-1">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="starting-bid"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="1.00"
                value={auctionSettings?.starting_bid || ""}
                onChange={(e) => handleChange("starting_bid", e.target.value)}
                className="pl-9"
                data-testid="starting-bid-input"
              />
            </div>
          </div>

          {/* Reserve Price (Optional) */}
          <div>
            <Label htmlFor="reserve-price" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Reserve Price
              <span className="text-xs text-muted-foreground">(Optional)</span>
            </Label>
            <div className="relative mt-1">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="reserve-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="Minimum price to sell"
                value={auctionSettings?.reserve_price || ""}
                onChange={(e) => handleChange("reserve_price", e.target.value)}
                className="pl-9"
                data-testid="reserve-price-input"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Item won&apos;t sell if final bid is below this price
            </p>
          </div>

          {/* Buy It Now Price (Optional) */}
          <div>
            <Label htmlFor="buy-now-price" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Buy It Now Price
              <span className="text-xs text-muted-foreground">(Optional)</span>
            </Label>
            <div className="relative mt-1">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="buy-now-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="Instant purchase price"
                value={auctionSettings?.buy_it_now_price || ""}
                onChange={(e) => handleChange("buy_it_now_price", e.target.value)}
                className="pl-9"
                data-testid="buy-now-price-input"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Allow buyers to skip bidding and buy instantly
            </p>
          </div>

          {/* Auto-Extend Toggle */}
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Auto-Extend</p>
                <p className="text-xs text-muted-foreground">
                  Add 5 min if bid in last 5 minutes
                </p>
              </div>
            </div>
            <Switch 
              checked={auctionSettings?.auto_extend !== false}
              onCheckedChange={(checked) => handleChange("auto_extend", checked)}
              data-testid="auto-extend-toggle"
            />
          </div>

          {/* Auto-Relist Toggle */}
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Auto-Relist</p>
                <p className="text-xs text-muted-foreground">
                  Automatically relist if no bids
                </p>
              </div>
            </div>
            <Switch 
              checked={auctionSettings?.auto_relist || false}
              onCheckedChange={(checked) => handleChange("auto_relist", checked)}
              data-testid="auto-relist-toggle"
            />
          </div>

          {/* Info Box */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">How auctions work:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Bidders compete until the timer ends</li>
                  <li>If reserve is set, item only sells if met</li>
                  <li>Auto-extend prevents last-second sniping</li>
                  <li>You can offer the item to losing bidders after</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
