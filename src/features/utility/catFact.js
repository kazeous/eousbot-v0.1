export async function fetchCatFact() {
  try {
    const res = await fetch("https://catfact.ninja/fact");
    if (!res.ok) {
      throw new Error(`Cat Facts API error: ${res.status}`);
    }
    const data = await res.json();
    return data.fact;
  } catch (err) {
    console.error("Failed to fetch cat fact:", err.message);
    return "Cats make about 100 different sounds. Dogs make only about 10."; // Premium fallback fact
  }
}
