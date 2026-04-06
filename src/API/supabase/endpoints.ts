export const supabaseEndpoints = {
  addFoodItem: "/food-items",
  searchFoodItems: "/food-items/search",
};

const addFoodItem = async (Food) => {
  const { data, error } = await supabase.from("foods").select("*");
  if (error) {
    console.log("Error fetching foods:", error);
  } else {
    setFoods(data);
  }
};
