import sys

with open('src/components/MatchPredictions.tsx', 'r') as f:
    content = f.read()

# Add Share2 import
content = content.replace("CheckCircle, Flame, Star, ChevronDown, Activity, ChevronLeft, ChevronRight, X } from 'lucide-react';", "CheckCircle, Flame, Star, ChevronDown, Activity, ChevronLeft, ChevronRight, X, Share2 } from 'lucide-react';")

old_handlePredict = """  const handlePredict = () => {
    setPredicted(true);
  };"""

new_handlePredict = """  const handlePredict = () => {
    setPredicted(true);
  };

  const handleShare = async () => {
    const shareData = {
      title: 'توقع المباراة',
      text: `لقد توقعت فوز الكابا بـ ${homeScore} - ${awayScore}! شارك توقعاتك عبر تطبيق الجراد الأصفر.`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback
        const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareData.text)}&url=${encodeURIComponent(shareData.url)}`;
        window.open(xUrl, '_blank');
      }
    } catch (err) {
      console.log('Error sharing:', err);
    }
  };"""

content = content.replace(old_handlePredict, new_handlePredict)


# Add Share Button after the change prediction button
old_predicted_state = """            <button 
              onClick={() => {setPredicted(false); setHomeScore(0); setAwayScore(0);}}
              className="mt-2 text-xs text-zinc-500 hover:text-white underline underline-offset-4 transition-colors"
            >
              تغيير التوقع
            </button>
          </div>"""

new_predicted_state = """            <div className="flex flex-col items-center gap-3">
              <button 
                onClick={handleShare}
                className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-sm font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 max-w-[200px]"
              >
                <Share2 size={16} /> شارك التوقع
              </button>
              <button 
                onClick={() => {setPredicted(false); setHomeScore(0); setAwayScore(0);}}
                className="text-xs text-zinc-500 hover:text-white underline underline-offset-4 transition-colors"
              >
                تغيير التوقع
              </button>
            </div>
          </div>"""

content = content.replace(old_predicted_state, new_predicted_state)

with open('src/components/MatchPredictions.tsx', 'w') as f:
    f.write(content)

