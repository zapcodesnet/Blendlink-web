import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { 
  Image, Video, Plus, Eye, DollarSign, MessageSquare, 
  ArrowLeft, Filter, Search, Trash2, MoreVertical,
  ShoppingBag
} from "lucide-react";
import { mediaAPI, offersAPI } from "../services/mediaSalesApi";

export default function MyMediaPage() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active"); // active, sold
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    fetchMedia();
    fetchOffers();
  }, [filter]);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const data = await mediaAPI.getMyMedia(0, 50, filter);
      setMedia(data);
    } catch (error) {
      console.error("Failed to load media:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOffers = async () => {
    try {
      const data = await offersAPI.getReceived("pending");
      setOffers(data);
    } catch (error) {
      console.error("Failed to load offers:", error);
    }
  };

  const handleDelete = async (mediaId) => {
    if (!confirm("Are you sure you want to delete this media?")) return;
    
    try {
      await mediaAPI.delete(mediaId);
      toast.success("Media deleted");
      setMedia(media.filter(m => m.media_id !== mediaId));
    } catch (error) {
      toast.error(error.message || "Failed to delete");
    }
  };

  const getOfferCount = (mediaId) => {
    return offers.filter(o => o.media_id === mediaId).length;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-bold">My Media</h1>
            </div>
            <Button onClick={() => navigate("/upload-media")}>
              <Plus className="w-4 h-4 mr-2" />
              Upload
            </Button>
          </div>
          
          {/* Filters */}
          <div className="flex gap-2">
            <Button
              variant={filter === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("active")}
            >
              Active
            </Button>
            <Button
              variant={filter === "sold" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("sold")}
            >
              Sold
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Offers Banner */}
        {offers.length > 0 && (
          <div 
            className="bg-green-500/10 rounded-xl p-4 mb-6 flex items-center justify-between cursor-pointer hover:bg-green-500/15 transition-colors"
            onClick={() => navigate("/offers")}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-green-700 dark:text-green-400">
                  {offers.length} pending offer{offers.length > 1 ? "s" : ""}!
                </p>
                <p className="text-sm text-muted-foreground">Click to review and respond</p>
              </div>
            </div>
            <Button variant="outline" size="sm">View Offers</Button>
          </div>
        )}

        {/* Media Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-square skeleton rounded-xl" />
            ))}
          </div>
        ) : media.length === 0 ? (
          <div className="text-center py-12">
            <Image className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">
              {filter === "active" ? "No media yet" : "No sold media"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {filter === "active" 
                ? "Upload photos and videos with watermarks to sell" 
                : "Sold media will appear here"}
            </p>
            {filter === "active" && (
              <Button onClick={() => navigate("/upload-media")}>
                <Plus className="w-4 h-4 mr-2" />
                Upload Your First Media
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {media.map((item) => (
              <div
                key={item.media_id}
                className="group relative bg-card rounded-xl overflow-hidden border border-border/50"
              >
                {/* Thumbnail */}
                <div className="aspect-square bg-muted relative">
                  <img
                    src={item.watermarked_url || item.thumbnail_url}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Type badge */}
                  <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 rounded-full text-white text-xs flex items-center gap-1">
                    {item.media_type === "photo" ? (
                      <Image className="w-3 h-3" />
                    ) : (
                      <Video className="w-3 h-3" />
                    )}
                  </div>

                  {/* Offer count badge */}
                  {getOfferCount(item.media_id) > 0 && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-green-500 rounded-full text-white text-xs font-medium">
                      {getOfferCount(item.media_id)} offer{getOfferCount(item.media_id) > 1 ? "s" : ""}
                    </div>
                  )}

                  {/* Sold badge */}
                  {item.status === "sold" && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="px-4 py-2 bg-green-500 text-white font-semibold rounded-full">
                        SOLD
                      </span>
                    </div>
                  )}

                  {/* Hover overlay */}
                  {item.status !== "sold" && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/media/${item.media_id}`)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(item.media_id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <h3 className="font-medium text-sm truncate">{item.title}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Eye className="w-3 h-3" />
                      {item.view_count}
                    </div>
                    {item.fixed_price ? (
                      <span className="text-sm font-semibold text-green-600">
                        ${item.fixed_price}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Offers only
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
