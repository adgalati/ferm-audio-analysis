import React from 'react';
import { Star } from 'lucide-react';

function FavoriteToggleButton({ recordId, clipName, isFavorite, notes, onToggled }) {
  const [loading, setLoading] = React.useState(false);
  const [favorite, setFavorite] = React.useState(!!isFavorite);

  React.useEffect(() => {
    setFavorite(!!isFavorite);
  }, [isFavorite]);

  const toggleFavorite = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const payload = { id: recordId, clipName, isFavorite: !favorite, notes: notes || null };
      const res = await window.electronAPI.mongodb('mongodb:update-favorite-status', payload);
      if (res?.success) {
        setFavorite(!favorite);
        onToggled && onToggled(!favorite);
      } else {
        console.error('Failed to update favorite:', res?.error);
      }
    } catch (e) {
      console.error('Favorite toggle error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleFavorite}
      disabled={loading}
      className={`inline-flex items-center justify-center rounded ${favorite ? 'text-yellow-400' : 'text-gray-400'} hover:text-yellow-300 transition-colors`}
      title={favorite ? 'Remove from favorites' : 'Mark as favorite'}
    >
      <Star className={`w-5 h-5 ${favorite ? 'fill-current' : ''}`} />
    </button>
  );
}

export default FavoriteToggleButton;

