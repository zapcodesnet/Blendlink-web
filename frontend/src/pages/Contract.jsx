import React, { useState, useEffect, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { 
  ArrowLeft, FileText, Check, Pen, Download, 
  User, DollarSign, Calendar, Image, Video,
  CheckCircle2, AlertCircle
} from "lucide-react";
import { contractsAPI } from "../services/mediaSalesApi";

export default function ContractPage() {
  const { contractId } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signatureType, setSignatureType] = useState("typed"); // typed or drawn
  const [typedSignature, setTypedSignature] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    fetchContract();
  }, [contractId]);

  const fetchContract = async () => {
    try {
      const data = await contractsAPI.get(contractId);
      setContract(data);
    } catch (error) {
      toast.error("Contract not found");
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  // Canvas drawing handlers
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getSignature = () => {
    if (signatureType === "typed") {
      return typedSignature;
    } else {
      const canvas = canvasRef.current;
      return canvas.toDataURL("image/png");
    }
  };

  const handleSign = async (role) => {
    const signature = getSignature();
    
    if (!signature || (signatureType === "typed" && !signature.trim())) {
      toast.error("Please provide your signature");
      return;
    }

    setSigning(true);
    try {
      if (role === "seller") {
        await contractsAPI.signAsSeller(contractId, signature, signatureType);
      } else {
        await contractsAPI.signAsBuyer(contractId, signature, signatureType);
      }
      
      toast.success("Contract signed successfully!");
      fetchContract();
    } catch (error) {
      toast.error(error.message || "Failed to sign contract");
    } finally {
      setSigning(false);
    }
  };

  const handleDownload = async () => {
    try {
      const { download_url, media_title } = await contractsAPI.download(contractId);
      
      // Create download link
      const link = document.createElement("a");
      link.href = download_url;
      link.download = media_title;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Download started!");
    } catch (error) {
      toast.error(error.message || "Failed to download");
    }
  };

  const isSeller = user?.user_id === contract?.seller_id;
  const isBuyer = user?.user_id === contract?.buyer_id || user?.email === contract?.buyer_email;
  const canSign = (isSeller && !contract?.seller_signature) || (isBuyer && !contract?.buyer_signature);
  const isFullySigned = contract?.status === "fully_signed" || contract?.status === "completed";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!contract) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold">Copyright Transfer Contract</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Status Banner */}
        <div className={`rounded-xl p-4 mb-6 flex items-center gap-3 ${
          isFullySigned 
            ? "bg-green-500/10" 
            : "bg-amber-500/10"
        }`}>
          {isFullySigned ? (
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          ) : (
            <AlertCircle className="w-6 h-6 text-amber-600" />
          )}
          <div>
            <p className={`font-semibold ${isFullySigned ? "text-green-700" : "text-amber-700"}`}>
              {isFullySigned 
                ? "Contract Complete - Both Parties Signed" 
                : `Awaiting Signatures (${contract.seller_signature ? "Seller signed" : "Seller pending"}, ${contract.buyer_signature ? "Buyer signed" : "Buyer pending"})`}
            </p>
            <p className="text-sm text-muted-foreground">
              {isFullySigned 
                ? "The buyer can now download the original unwatermarked media"
                : "Both parties must sign to complete the transfer"}
            </p>
          </div>
        </div>

        {/* Contract Document */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-border bg-muted/30">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-8 h-8 text-primary" />
              <div>
                <h2 className="text-xl font-bold">Media Copyright Transfer Agreement</h2>
                <p className="text-sm text-muted-foreground">Contract ID: {contract.contract_id}</p>
              </div>
            </div>
          </div>

          {/* Media Info */}
          <div className="p-6 border-b border-border">
            <h3 className="font-semibold mb-4">Subject Media</h3>
            <div className="flex gap-4">
              {contract.media && (
                <div className="w-32 h-32 rounded-lg bg-muted overflow-hidden">
                  <img 
                    src={contract.media.watermarked_url} 
                    alt={contract.media.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {contract.media_type === "photo" ? (
                    <Image className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Video className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="text-sm text-muted-foreground capitalize">{contract.media_type}</span>
                </div>
                <p className="font-semibold">{contract.media_title}</p>
              </div>
            </div>
          </div>

          {/* Parties */}
          <div className="p-6 border-b border-border grid md:grid-cols-2 gap-6">
            {/* Seller */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Seller (Copyright Holder)
              </h3>
              {contract.seller && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted overflow-hidden">
                    {contract.seller.avatar ? (
                      <img src={contract.seller.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-full h-full p-2 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{contract.seller.name}</p>
                    <p className="text-sm text-muted-foreground">{contract.seller.email}</p>
                  </div>
                </div>
              )}
              {contract.seller_signature && (
                <div className="mt-3 p-3 bg-green-500/10 rounded-lg">
                  <p className="text-xs text-green-600 mb-1">Signed on {new Date(contract.seller_signed_at).toLocaleString()}</p>
                  {contract.seller_signature_type === "typed" ? (
                    <p className="font-signature text-xl">{contract.seller_signature}</p>
                  ) : (
                    <img src={contract.seller_signature} alt="Seller signature" className="max-h-16" />
                  )}
                </div>
              )}
            </div>

            {/* Buyer */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Buyer (Rights Recipient)
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{contract.buyer_name}</p>
                  <p className="text-sm text-muted-foreground">{contract.buyer_email}</p>
                </div>
              </div>
              {contract.buyer_signature && (
                <div className="mt-3 p-3 bg-green-500/10 rounded-lg">
                  <p className="text-xs text-green-600 mb-1">Signed on {new Date(contract.buyer_signed_at).toLocaleString()}</p>
                  {contract.buyer_signature_type === "typed" ? (
                    <p className="font-signature text-xl">{contract.buyer_signature}</p>
                  ) : (
                    <img src={contract.buyer_signature} alt="Buyer signature" className="max-h-16" />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Terms */}
          <div className="p-6 border-b border-border">
            <h3 className="font-semibold mb-3">Transfer Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Purchase Amount</p>
                <p className="font-semibold text-lg flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  {contract.amount.toFixed(2)} USD
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Transfer Date</p>
                <p className="font-semibold flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(contract.transfer_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Legal Terms */}
          <div className="p-6 border-b border-border">
            <h3 className="font-semibold mb-3">Terms & Conditions</h3>
            <div className="text-sm text-muted-foreground space-y-2 bg-muted/30 p-4 rounded-lg">
              <p>1. The Seller hereby transfers all copyright, ownership, and intellectual property rights of the above-described media to the Buyer.</p>
              <p>2. Upon completion of this agreement, the Seller agrees to remove the watermarked version from public display.</p>
              <p>3. The Buyer receives full rights to use, modify, distribute, and sell the media as they see fit.</p>
              <p>4. This transfer is permanent and irrevocable once both parties have signed.</p>
              <p>5. The payment amount covers all rights transfers with no additional royalties or fees.</p>
            </div>
          </div>

          {/* Signature Area */}
          {canSign && (
            <div className="p-6 bg-muted/30">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Pen className="w-4 h-4" />
                Sign Contract as {isSeller ? "Seller" : "Buyer"}
              </h3>

              {/* Signature Type Toggle */}
              <div className="flex gap-2 mb-4">
                <Button
                  variant={signatureType === "typed" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSignatureType("typed")}
                >
                  Type Signature
                </Button>
                <Button
                  variant={signatureType === "drawn" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSignatureType("drawn")}
                >
                  Draw Signature
                </Button>
              </div>

              {signatureType === "typed" ? (
                <div className="space-y-2">
                  <Label>Type your full legal name</Label>
                  <Input
                    value={typedSignature}
                    onChange={(e) => setTypedSignature(e.target.value)}
                    placeholder="Your Full Name"
                    className="font-signature text-xl h-14"
                    data-testid="typed-signature"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Draw your signature below</Label>
                  <div className="relative">
                    <canvas
                      ref={canvasRef}
                      width={400}
                      height={150}
                      className="border border-border rounded-lg bg-white w-full cursor-crosshair"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={clearCanvas}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}

              <Button
                className="w-full mt-4"
                onClick={() => handleSign(isSeller ? "seller" : "buyer")}
                disabled={signing}
                data-testid="sign-contract-btn"
              >
                {signing ? (
                  "Signing..."
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Sign Contract
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Download Section */}
          {isFullySigned && isBuyer && (
            <div className="p-6 bg-green-500/10">
              <h3 className="font-semibold mb-2 text-green-700">Download Original Media</h3>
              <p className="text-sm text-muted-foreground mb-4">
                The contract is complete. You can now download the original unwatermarked media.
              </p>
              <Button onClick={handleDownload} data-testid="download-media-btn">
                <Download className="w-4 h-4 mr-2" />
                Download Original Media
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Custom font for signature */}
      <style>{`
        .font-signature {
          font-family: 'Brush Script MT', 'Segoe Script', cursive;
        }
      `}</style>
    </div>
  );
}
