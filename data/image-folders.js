// Catalog images that exist only in "media floral/" (generated from git ls-files).
// data/inventory.js and fixCatalogImgSrc() use this to request the right folder
// up front, instead of trying "media rentals/" first and waiting for its 404.
const EF_FLORAL_ONLY = new Set([
  "image1.jpeg", "image2.jpeg", "image3.jpeg", "image4.jpeg", "image6.jpeg", "image8.jpeg", "image14.jpeg", "image26.jpg",
  "image30.png", "image38.jpeg", "image44.png", "image45.png", "image47.png", "image48.png", "image49.png", "image50.png",
  "image51.png", "image53.png", "image54.png", "image59.png", "image60.png", "image64.png", "image66.jpg", "image70.png",
  "image74.png", "image76.png", "image77.png", "image78.png", "image80.png", "image81.png", "image86.jpeg", "image140.jpg",
  "image142.png", "image155.png", "image156.png", "image157.png", "image158.png", "image159.png", "image166.png", "image167.png",
  "image171.jpeg", "image172.jpeg", "image176.jpg", "image185.png", "image186.jpg", "image187.jpg", "image190.png", "image191.png",
  "image204.png", "image205.png", "image206.png", "image233.png", "image234.png", "image235.png", "image236.png", "image239.png",
  "image249.png", "image250.png", "image266.png", "image269.png", "image281.png", "image323.jpeg", "image350.png", "image351.png",
  "image352.png", "image353.png", "image373.jpg", "image374.png", "image375.png", "image376.png", "image377.png", "image378.png",
  "image379.png", "image380.png", "image381.png", "image382.png", "image383.jpg", "image384.png", "image385.png", "image386.png",
  "image387.png", "image388.png", "image389.png", "image390.png", "image391.png", "image392.png", "image393.png", "image394.png",
  "image395.png", "image396.png", "image397.png", "image398.png", "image399.png", "image400.png", "image401.png", "image402.png",
  "image403.png", "image404.png", "image405.png", "image406.png", "image407.png", "image408.png", "image409.png", "image410.png",
  "image411.png", "image412.png", "image413.png", "image414.png", "image415.png", "image416.png", "image417.png", "image418.png",
  "image419.png", "image420.png", "image421.png", "image422.png", "image423.png", "image424.png", "image425.png", "image426.png",
  "image427.png", "image428.png", "image429.png", "image430.png", "image431.png", "image432.png", "image433.png", "image434.png",
  "image435.png", "image436.png", "image437.png", "image438.png", "image439.png", "image440.png", "image441.png", "image442.png",
  "image443.png", "image444.png", "image445.png", "image446.png", "image447.png", "image448.png", "image449.png", "image450.png",
  "image451.png", "image452.png", "image453.png", "image454.png", "image455.png", "image456.png", "image457.png",
]);
