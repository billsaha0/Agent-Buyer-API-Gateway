import prisma from "../src/lib/prisma";

async function main() {
  console.log("Fetching a product to restock...");
  
  // Find the first product to test with
  const product = await prisma.product.findFirst({
    orderBy: { stock: 'asc' } // Grab the one with the lowest stock
  });
  
  if (!product) {
    console.log("No products found in the database.");
    return;
  }

  const amountToAdd = 15;

  console.log(`\nRestocking: ${product.name}`);
  console.log(`   ❯ Current Stock: ${product.stock}`);
  console.log(`   ❯ Adding: +${amountToAdd}`);

  // Increment the stock directly in the database
  const updatedProduct = await prisma.product.update({
    where: { id: product.id },
    data: { 
      stock: { increment: amountToAdd } 
    }
  });

  console.log(`Success! New Stock: ${updatedProduct.stock}`);
  console.log(`\nCheck your Next.js dashboard. It should have updated instantly!`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });