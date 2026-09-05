"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/generated/prisma/client";

type InventoryItem = Pick<Product, "id" | "name" | "price" | "stock" | "category">;

export default function LiveInventoryTable({
  initialProducts,
  sortParam,
}: {
  initialProducts: InventoryItem[];
  sortParam: "name" | "stock";
}) {
  const [products, setProducts] = useState<InventoryItem[]>(initialProducts);

  useEffect(() => {
    const eventSource = new EventSource("/api/v1/admin/inventory/stream");

    eventSource.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.type === "inventory") {
        setProducts(parsed.data);
      }
    };

    return () => eventSource.close();
  }, []);

  // Apply sorting dynamically whenever data updates or the URL parameter changes
  const sortedProducts = [...products].sort((a, b) => {
    if (sortParam === "stock") return a.stock - b.stock;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden shadow-2xl">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-800 text-gray-400">
          <tr>
            <th className="p-4 font-medium">Product Name</th>
            <th className="p-4 font-medium">Category</th>
            <th className="p-4 font-medium">Price (INR)</th>
            <th className="p-4 font-medium">Available Stock</th>
            <th className="p-4 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {sortedProducts.map((product) => (
            <tr key={product.id} className="hover:bg-gray-800/50 transition-colors">
              <td className="p-4 font-medium text-gray-200">
                {product.name}
                <div className="text-xs font-mono text-gray-500 mt-1">{product.id}</div>
              </td>
              <td className="p-4 text-gray-400">{product.category}</td>
              <td className="p-4 font-mono text-gray-300">
                ₹{(product.price / 100).toLocaleString()}
              </td>
              <td className="p-4 font-mono text-gray-300">
                <span className={product.stock === 0 ? "text-red-400 font-bold" : ""}>
                  {product.stock}
                </span>
              </td>
              <td className="p-4">
                {product.stock === 0 ? (
                  <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs border border-red-800 font-medium">
                    OUT OF STOCK
                  </span>
                ) : product.stock < 10 ? (
                  <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 rounded text-xs border border-yellow-800 font-medium">
                    LOW INVENTORY
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs border border-green-800 font-medium">
                    HEALTHY
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}