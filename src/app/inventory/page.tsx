import prisma from "@/lib/prisma";
import Link from "next/link";
import LiveInventoryTable from "@/components/LiveInventoryTable";

export const dynamic = "force-dynamic";

export default async function InventoryDashboard({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const resolvedParams = await searchParams;
  const sortParam = resolvedParams.sort === "stock" ? "stock" : "name";

  const products = await prisma.product.findMany({
    orderBy: { [sortParam]: "asc" },
    select: {
      id: true,
      name: true,
      price: true,
      stock: true,
      category: true,
    },
  });

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">Inventory Management</h1>
            <p className="text-gray-400 mt-2">Real-time catalog view for human administrators.</p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex gap-4">
              <Link 
                href="/inventory?sort=name"
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${sortParam === 'name' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >
                Sort Alphabetical
              </Link>
              <Link 
                href="/inventory?sort=stock"
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${sortParam === 'stock' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >
                Sort by Low Stock
              </Link>
            </div>
          </div>
        </div>
        
        <LiveInventoryTable initialProducts={products} sortParam={sortParam} />
      </div>
    </div>
  );
}