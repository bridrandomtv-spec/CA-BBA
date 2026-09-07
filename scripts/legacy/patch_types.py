import re

with open("src/types.ts", "r") as f:
    content = f.read()

product_search = """export interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  category: 'kit' | 'merch';
}"""

product_replace = """export interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  category: 'kit' | 'merch';
  stock?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  userId: string;
  items: { productId: string; name: string; quantity: number; price: number }[];
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: number;
}"""

content = content.replace(product_search, product_replace)

with open("src/types.ts", "w") as f:
    f.write(content)
