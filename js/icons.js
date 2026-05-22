// Font Awesome Icon Mapping for Fallout Shelter Resources
const RESOURCE_ICONS = {"caps":"fa-coins","nuka":"fa-flask","food":"fa-utensils","water":"fa-droplet","energy":"fa-bolt","power":"fa-bolt","stimpack":"fa-heart-pulse","radaway":"fa-flask-vial","lunchbox":"fa-box","mrhandy":"fa-robot","petcarrier":"fa-dog","starter":"fa-gift","default":"fa-cube"};
const RESOURCE_FIELD_ICONS = {"Caps":"caps","NukaColaQuantum":"nuka","Food":"food","Water":"water","Energy":"energy","Power":"power","StimPack":"stimpack","RadAway":"radaway","MrHandy":"mrhandy","PetCarrier":"petcarrier","Lunchboxes":"lunchbox","LunchBoxesCount":"lunchbox"};

const getResourceIcon = field => RESOURCE_ICONS[RESOURCE_FIELD_ICONS[field] || field.toLowerCase()] || RESOURCE_ICONS['default'];
const getIconHtml = (field, cls = '') => `<i class="fas ${getResourceIcon(field)} ${cls}" title="${field}"></i>`;
const getIcon = getResourceIcon;
