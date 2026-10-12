import product from "./product.json";

// The product name lives only in product.json so it can be changed in one place
// (the auth email settings workflow reads the same file).
// TODO: nombre definitivo del producto (aún no decidido).
export const PRODUCT_NAME: string = product.name;
