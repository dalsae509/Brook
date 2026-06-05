export const getCloudinaryUrl = (url, { width, height, crop = "fill" } = {}) => {
  if (!url || !url.includes("res.cloudinary.com")) return url;

  const params = ["q_auto", "f_auto"];
  if (width) params.push(`w_${width}`);
  if (height) params.push(`h_${height}`);
  if (width && height) params.push(`c_${crop}`);

  return url.replace("/upload/", `/upload/${params.join(",")}/`);
};
