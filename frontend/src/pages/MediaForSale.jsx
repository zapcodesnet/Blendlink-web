import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { 
  Image, Video, Eye, DollarSign, User, Search, 
  Filter, ShoppingBag, ArrowLeft
} from "lucide-react";
import { mediaAPI } from "../services/mediaSalesApi";
import OfferModal from "../components/OfferModal";

export default function MediaForSalePage() {
  const navigate = useNavigate();
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, photo, video
  const [search, setSearch] = useState("");
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [showOfferModal, setShowOfferModal] = useState(false);

  useEffect(() => {
    fetchMedia();
  }, [filter]);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const mediaType = filter === "all" ? null : filter;
      const data = await mediaAPI.getForSale(0, 50, mediaType);
      setMedia(data);
    } catch (error) {
      console.error("Failed to load media:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMedia = media.filter(m => 
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleMakeOffer = (item) => {
    setSelectedMedia(item);
    setShowOfferModal(true);
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
              <h1 className="text-xl font-bold">Media For Sale</h1>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search media..."
              className="pl-10 rounded-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          {/* Filters */}
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "photo" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("photo")}
            >
              <Image className="w-4 h-4 mr-1" />
              Photos
            </Button>
            <Button
              variant={filter === "video" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("video")}
            >
              <Video className="w-4 h-4 mr-1" />
              Videos
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-square skeleton rounded-xl" />
            ))}
          </div>
        ) : filteredMedia.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No media for sale</h3>
            <p className="text-muted-foreground">
              Check back later for new watermarked content
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredMedia.map((item) => (
              <div
                key={item.media_id}
                className="group bg-card rounded-xl overflow-hidden border border-border/50 card-hover"
              >
                {/* Thumbnail */}
                <div 
                  className="aspect-square bg-muted relative cursor-pointer"
                  onClick={() => navigate(`/media/${item.media_id}`)}
                >
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

                  {/* Price badge */}
                  {item.fixed_price && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-green-500 rounded-full text-white text-xs font-medium">
                      ${item.fixed_price}
                    </div>
                  )}

                  {/* Watermark indicator */}
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 rounded-full text-white text-xs">
                    Watermarked
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <h3 className="font-medium text-sm truncate">{item.title}</h3>
                  
                  {/* Seller info */}
                  {item.seller && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-6 h-6 rounded-full bg-muted overflow-hidden">
                        {item.seller.avatar ? (
                          <img src={item.seller.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-full h-full p-1 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground truncate">
                        {item.seller.name}
                      </span>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Eye className="w-3 h-3" />
                      {item.view_count}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMakeOffer(item);
                      }}
                      data-testid={`offer-${item.media_id}`}
                    >
                      <DollarSign className="w-3 h-3 mr-1" />
                      Make Offer
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Offer Modal */}
      {showOfferModal && selectedMedia && (
        <OfferModal
          media={selectedMedia}
          onClose={() => {
            setShowOfferModal(false);
            setSelectedMedia(null);
          }}
          onSuccess={() => {
            setShowOfferModal(false);
            setSelectedMedia(null);
          }}
        />
      )}
    </div>
  );
}
