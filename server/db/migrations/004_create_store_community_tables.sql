-- Tables reprenant les collections Firestore : produits, commandes, adhésions,
-- publications de la communauté.
--
-- Ces données vivaient dans Firestore, interrogé directement par le navigateur.
-- Trois problèmes justifiaient la reprise :
--
--  1. Firebase Auth n'était pas utilisé, donc `request.auth` valait toujours
--     null et toutes les écritures étaient refusées en production.
--  2. Les règles autorisaient `update` sur /products à tout compte connecté :
--     un acheteur pouvait modifier un prix avant de commander.
--  3. Le rôle admin était lu dans Firestore alors que les comptes vivaient
--     dans PostgreSQL — deux sources de vérité pour la même autorisation.


-- =========================================================================
-- Boutique
-- =========================================================================

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  -- Prix en dinars, entier : la monnaie n'a pas de subdivision en usage et un
  -- entier évite les erreurs d'arrondi des flottants sur les totaux.
  price INTEGER NOT NULL CHECK (price >= 0),
  image_url TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- La vitrine ne liste que les produits en vente : index partiel.
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active) WHERE active;

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT et non CASCADE : une commande est une pièce comptable, elle ne
  -- doit pas disparaître avec le compte de son auteur.
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  total INTEGER NOT NULL CHECK (total >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);

-- Les lignes de commande sont une table à part, alors que Firestore les
-- stockait dans un tableau imbriqué : on peut ainsi calculer les ventes par
-- produit en SQL.
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  -- Le produit peut être retiré du catalogue : la référence devient NULL mais
  -- le nom et le prix restent, figés au moment de l'achat.
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);


-- =========================================================================
-- Adhésions
-- =========================================================================

CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Numéro de carte affiché et encodé dans le QR code : unique par construction.
  member_number VARCHAR(32) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (type IN ('standard', 'gold', 'vip')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended', 'expired')),
  start_date DATE NOT NULL,
  expiration_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT memberships_dates_ordered CHECK (expiration_date >= start_date)
);

-- Un supporter ne peut pas cumuler deux adhésions en cours. L'index partiel
-- laisse en revanche l'historique des adhésions expirées s'accumuler.
CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_one_active_per_user
  ON memberships(user_id)
  WHERE status IN ('pending', 'active');


-- =========================================================================
-- Communauté
-- =========================================================================

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  -- Image redimensionnée côté client (800 px max, JPEG qualité 0,6) et stockée
  -- en data URL. Un stockage objet serait plus propre, mais demanderait un
  -- service de plus à administrer pour des images de l'ordre de 100 Ko.
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  -- Un contenu vide ET sans image n'a pas de sens.
  CONSTRAINT posts_not_empty CHECK (content <> '' OR image_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);

-- Les mentions « j'aime » étaient deux champs du document : un compteur et un
-- booléen `isLiked` partagé par tous les visiteurs. Le premier supporter à
-- aimer une publication la marquait donc comme aimée pour tout le monde, et un
-- second clic par un autre compte décrémentait le compteur.
--
-- Une ligne par (publication, utilisateur) rend l'opération idempotente et le
-- compteur exact.
CREATE TABLE IF NOT EXISTS post_likes (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (content <> ''),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id, created_at);
