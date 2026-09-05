import prisma from '../src/lib/prisma';
import { getEmbedding } from '../src/lib/gemini';

const products = [
  {
    name: "ErgoPro Mechanical Keyboard",
    price: 450000, // ₹4500.00
    stock: 50,
    category: "Peripherals",
    description: "A high-performance mechanical keyboard with tactile switches, RGB backlighting, and an ergonomic wrist rest designed for long coding sessions and gaming."
  },
  {
    name: "UltraView 4K Monitor",
    price: 2500000, // ₹25,000.00
    stock: 15,
    category: "Displays",
    description: "27-inch 4K UHD monitor with 144Hz refresh rate, 1ms response time, and color-accurate IPS panel. Perfect for gaming and professional video editing."
  },
  {
    name: "Aero Mesh Desk Chair",
    price: 850000, // ₹8500.00
    stock: 20,
    category: "Furniture",
    description: "Ergonomic mesh office chair with adjustable lumbar support, 3D armrests, and a breathable back for maximum comfort during long work hours."
  },
  {
    name: "NoiseCanceller Pro Headphones",
    price: 1200000, // ₹12,000.00
    stock: 30,
    category: "Audio",
    description: "Over-ear wireless headphones featuring active noise cancellation, 40-hour battery life, and spatial audio support. Ideal for deep work and travel."
  }
];

async function main() {
  console.log("Starting database seed...");

  for (const item of products) {
    console.log(`Processing: ${item.name}`);
    
    // 1. Generate the vector embedding using Gemini
    // We combine the name and description to give the AI better context
    const textToEmbed = `${item.name}: ${item.description}`;
    const vectorArray = await getEmbedding(textToEmbed);
    
    // PostgreSQL pgvector expects the array as a string formatted like "[0.1, 0.2, ...]"
    const vectorString = `[${vectorArray.join(',')}]`;
    
    // 2. Insert the product without the embedding first via standard Prisma
    const product = await prisma.product.create({
      data: {
        name: item.name,
        price: item.price,
        stock: item.stock,
        category: item.category,
        description: item.description
      }
    });

    // 3. Update the product with the vector using a raw SQL query
    await prisma.$executeRaw`UPDATE "Product" SET embedding = ${vectorString}::vector WHERE id = ${product.id}`;
    
    console.log(`Inserted ${item.name} with vector embedding.`);
  }
  
  // 4. Create a test AgentSession so we have a valid key to test our API Gateway later
  // await prisma.agentSession.create({
  //   data: {
  //     agentName: "Test-Buyer-Agent",
  //     apiKeyHash: "test_api_key_123", // We will replace this with dynamic tokens next
  //     budgetLimit: 5000000, 
  //     expiresAt: new Date(Date.now() + 60 * 60 * 1000), // Expires in 1 hour
  //   }
  // });
  // console.log(`Created test Agent Session with API Key: 'test_api_key_123'`);

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });