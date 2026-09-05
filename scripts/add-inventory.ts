const BASE_URL = process.env.BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
const ADMIN_SECRET = process.env.ADMIN_SECRET || "super_secure_admin_secret";

const newProducts = [
  {
    name: "Apex Motorized Standing Desk",
    price: 3500000, // ₹35,000.00
    stock: 12,
    category: "Furniture",
    description: "Dual-motor height adjustable desk with memory presets, anti-collision technology, and a solid walnut wood top."
  },
  {
    name: "ErgoGrip Vertical Mouse",
    price: 350000, // ₹3,500.00
    stock: 40,
    category: "Peripherals",
    description: "Wireless vertical mouse designed to reduce wrist strain. Features customizable buttons and a rechargeable battery."
  },
  {
    name: "StreamPro 4K Webcam",
    price: 1250000, // ₹12,500.00
    stock: 25,
    category: "Video",
    description: "Ultra HD 4K webcam with AI tracking, adjustable field of view, and dual omnidirectional microphones for clear video calls."
  },
  {
    name: "ThunderCore 12-in-1 Dock",
    price: 1800000, // ₹18,000.00
    stock: 10,
    category: "Accessories",
    description: "Thunderbolt 4 docking station with dual 4K monitor support, 100W power delivery, and gigabit ethernet."
  },
  {
    name: "Artisan Leather Desk Mat",
    price: 250000, // ₹2,500.00
    stock: 60,
    category: "Accessories",
    description: "Premium full-grain leather desk pad. Protects your desk surface while providing a smooth tracking area for your mouse."
  },
  {
    name: "FlexiArm Dual Monitor Mount",
    price: 650000, // ₹6,500.00
    stock: 20,
    category: "Furniture",
    description: "Heavy-duty gas spring dual monitor arm. Supports screens up to 32 inches with full tilt, swivel, and rotation capabilities."
  },
  {
    name: "Magneto Cable Spine",
    price: 150000, // ₹1,500.00
    stock: 80,
    category: "Accessories",
    description: "Magnetic under-desk cable management spine to route wires neatly from your desk to the floor."
  },
  {
    name: "Aero Aluminum Laptop Riser",
    price: 280000, // ₹2,800.00
    stock: 35,
    category: "Accessories",
    description: "Minimalist aluminum laptop stand that elevates your screen to eye level and improves cooling airflow."
  },
  {
    name: "Echo Hex Acoustic Panels",
    price: 420000, // ₹4,200.00
    stock: 100,
    category: "Decor",
    description: "Pack of 12 hexagonal sound-dampening wall panels to reduce room echo for cleaner podcast and video meeting audio."
  },
  {
    name: "Lumina Smart LED Desk Lamp",
    price: 550000, // ₹5,500.00
    stock: 18,
    category: "Lighting",
    description: "App-controlled smart desk lamp with auto-dimming sensors, adjustable color temperature, and a built-in wireless phone charger."
  }
];

async function seedInventory() {
  console.log(`Starting inventory insertion via API Gateway...\n`);
  
  for (let i = 0; i < newProducts.length; i++) {
    const product = newProducts[i];
    console.log(`[${i + 1}/10] Pushing: ${product.name}...`);
    
    try {
      const res = await fetch(`${BASE_URL}/api/v1/admin/inventory`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": ADMIN_SECRET
        },
        body: JSON.stringify(product)
      });

      const data = await res.json();

      if (res.ok) {
        console.log(`Success: Vectorized and inserted with ID ${data.data.id}`);
      } else {
        console.error(`Failed: HTTP ${res.status}`, data.error);
      }
    } catch (error) {
      console.error(`Network/Runtime Error:`, error);
    }
  }
  console.log(`\nInventory population complete!`);
}

seedInventory();