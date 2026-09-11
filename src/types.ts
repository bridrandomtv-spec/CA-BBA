export type Tab = 'home' | 'match' | 'chants' | 'tv' | 'store' | 'profile' | 'community' | 'admin';

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  date: string;
  createdAt: number;
}

export interface MediaItem {
  id: string;
  title: string;
  duration: string;
  type: 'audio' | 'video';
  thumbnailUrl?: string;
  lyrics?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  category: string;
  stock?: number;
  active?: boolean;
  description?: string;
  createdAt?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: number;
}

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  date: string;
  time: string;
  stadium: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  homeScore: number;
  awayScore: number;
  createdAt: number;
  elapsedMinute?: number | null;
  extraMinute?: number | null;
  apiStatus?: string | null;
  apiFixtureId?: number | null;
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  role: 'user' | 'admin' | 'scanner';
  createdAt?: string;
}
