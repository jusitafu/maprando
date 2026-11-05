/**
 * Screen Calibration Manager - RandoFinder
 * Permet d'étalonner l'écran pour que 1 cm mesuré à la règle sur la vitre
 * corresponde exactement à l'échelle métrique sur le terrain (ex : 1 : 25 000 ou 1 : 125 000).
 * Choix par Marque et Modèle des 10 dernières années (Apple, HP, Lenovo, Dell, ASUS, Acer, Moniteurs).
 * JLDApps 2026
 */

(function () {
  const STORAGE_KEY = 'randofinder_screen_calibration';

  // 1. Les 6 marques les plus diffusées (+ Moniteurs fixes universels et standard web)
  const SCREEN_BRANDS = [
    { id: 'apple', name: '🍎 Apple (MacBook Air / Pro, iMac, iPad)', icon: '🍎' },
    { id: 'hp', name: '💻 HP (Pavilion, Envy, Spectre, 14/15/17, ProBook...)', icon: '💻' },
    { id: 'lenovo', name: '💻 Lenovo (ThinkPad, IdeaPad, Yoga, Legion...)', icon: '💻' },
    { id: 'dell', name: '💻 Dell (Inspiron, XPS, Latitude, Alienware...)', icon: '💻' },
    { id: 'asus', name: '💻 ASUS (ZenBook, VivoBook, ROG, TUF Gaming...)', icon: '💻' },
    { id: 'acer', name: '💻 Acer (Aspire, Swift, Spin, Nitro, Predator...)', icon: '💻' },
    { id: 'monitors', name: '🖥️ Moniteurs fixes de bureau (21.5", 24", 27", 32")', icon: '🖥️' },
    { id: 'generic', name: '🌐 Standard Web générique (96 DPI non étalonné)', icon: '🌐' }
  ];

  // 2. Base des modèles des 10 dernières années (2014-2024+)
  const SCREEN_MODELS = [
    // --- APPLE ---
    { id: 'mac_air_13_m1', brandId: 'apple', name: 'MacBook Air 13,3" Retina (M1 & Intel 2018–2020) ⭐', desc: '13,3" • 2560×1600 • 227 PPI', diagInch: 13.3, resW: 2560, resH: 1600, forcedPpi: 227, isDefault: true },
    { id: 'mac_air_13_m2', brandId: 'apple', name: 'MacBook Air 13,6" Liquid Retina (M2 / M3 2022–2024)', desc: '13,6" • 2560×1664 • 224 PPI', diagInch: 13.6, resW: 2560, resH: 1664, forcedPpi: 224 },
    { id: 'mac_air_15_m2', brandId: 'apple', name: 'MacBook Air 15,3" Liquid Retina (M2 / M3 2023–2024)', desc: '15,3" • 2880×1864 • 224 PPI', diagInch: 15.3, resW: 2880, resH: 1864, forcedPpi: 224 },
    { id: 'mac_pro_13_retina', brandId: 'apple', name: 'MacBook Pro 13,3" Retina (2014–2022 Intel & M1/M2)', desc: '13,3" • 2560×1600 • 227 PPI', diagInch: 13.3, resW: 2560, resH: 1600, forcedPpi: 227 },
    { id: 'mac_pro_14_m', brandId: 'apple', name: 'MacBook Pro 14,2" Liquid Retina XDR (M1/M2/M3 Pro/Max)', desc: '14,2" • 3024×1964 • 254 PPI', diagInch: 14.2, resW: 3024, resH: 1964, forcedPpi: 254 },
    { id: 'mac_pro_15_retina', brandId: 'apple', name: 'MacBook Pro 15,4" Retina (2014–2019 Intel)', desc: '15,4" • 2880×1800 • 220 PPI', diagInch: 15.4, resW: 2880, resH: 1800, forcedPpi: 220 },
    { id: 'mac_pro_16_intel', brandId: 'apple', name: 'MacBook Pro 16,0" Retina (2019 Intel)', desc: '16,0" • 3072×1920 • 226 PPI', diagInch: 16.0, resW: 3072, resH: 1920, forcedPpi: 226 },
    { id: 'mac_pro_16_m', brandId: 'apple', name: 'MacBook Pro 16,2" Liquid Retina XDR (M1/M2/M3 Pro/Max)', desc: '16,2" • 3456×2234 • 254 PPI', diagInch: 16.2, resW: 3456, resH: 2234, forcedPpi: 254 },
    { id: 'imac_21_fhd', brandId: 'apple', name: 'iMac 21,5" Full HD (2014–2020 Intel)', desc: '21,5" • 1920×1080 • 102 PPI', diagInch: 21.5, resW: 1920, resH: 1080, forcedPpi: 102.5 },
    { id: 'imac_21_4k', brandId: 'apple', name: 'iMac 21,5" 4K Retina (2015–2020 Intel)', desc: '21,5" • 4096×2304 • 219 PPI', diagInch: 21.5, resW: 4096, resH: 2304, forcedPpi: 219 },
    { id: 'imac_24_m', brandId: 'apple', name: 'iMac 24" 4.5K Retina (M1 & M3 2021–2024)', desc: '23,5" • 4480×2520 • 218 PPI', diagInch: 23.5, resW: 4480, resH: 2520, forcedPpi: 218 },
    { id: 'imac_27_5k', brandId: 'apple', name: 'iMac 27" 5K Retina (2014–2020 Intel)', desc: '27,0" • 5120×2880 • 218 PPI', diagInch: 27.0, resW: 5120, resH: 2880, forcedPpi: 218 },
    { id: 'ipad_10_2', brandId: 'apple', name: 'iPad 10,2" (7e, 8e, 9e gén. 2019–2024)', desc: '10,2" • 2160×1620 • 264 PPI', diagInch: 10.2, resW: 2160, resH: 1620, forcedPpi: 264 },
    { id: 'ipad_10_9', brandId: 'apple', name: 'iPad 10,9" & iPad Air (4e, 5e, M2 2020–2024)', desc: '10,9" • 2360×1640 • 264 PPI', diagInch: 10.9, resW: 2360, resH: 1640, forcedPpi: 264 },
    { id: 'ipad_pro_11', brandId: 'apple', name: 'iPad Pro 11" (1re à 4e gén. & M4 2018–2024)', desc: '11,0" • 2388×1668 • 264 PPI', diagInch: 11.0, resW: 2388, resH: 1668, forcedPpi: 264 },
    { id: 'ipad_pro_12_9', brandId: 'apple', name: 'iPad Pro 12,9" / 13" (1re à 6e gén. & M4 2015–2024)', desc: '12,9" • 2732×2048 • 264 PPI', diagInch: 12.9, resW: 2732, resH: 2048, forcedPpi: 264 },

    // --- HP (HEWLETT-PACKARD) ---
    { id: 'hp_15_fhd', brandId: 'hp', name: 'HP 15 / Pavilion 15 / 250 / 255 (15,6" Full HD) ⭐', desc: '15,6" • 1920×1080 • 141.2 PPI (N°1 des ventes)', diagInch: 15.6, resW: 1920, resH: 1080, isDefault: true },
    { id: 'hp_15_hd', brandId: 'hp', name: 'HP 15 / 250 entrée de gamme (15,6" HD 1366×768)', desc: '15,6" • 1366×768 • 100.5 PPI', diagInch: 15.6, resW: 1366, resH: 768 },
    { id: 'hp_14_fhd', brandId: 'hp', name: 'HP 14 / Pavilion 14 / ProBook 440 / EliteBook 840 (14,0" FHD)', desc: '14,0" • 1920×1080 • 157.4 PPI', diagInch: 14.0, resW: 1920, resH: 1080 },
    { id: 'hp_14_1610', brandId: 'hp', name: 'HP Pavilion Plus 14 / Envy 14 16:10 (2.2K / 2.8K OLED)', desc: '14,0" • 2240×1400 / 2880×1800 • ~200 PPI', diagInch: 14.0, resW: 2240, resH: 1400 },
    { id: 'hp_16_1610', brandId: 'hp', name: 'HP Pavilion Plus 16 / Envy 16 16:10 (16,0" FHD+ 1920×1200)', desc: '16,0" • 1920×1200 • 141.6 PPI', diagInch: 16.0, resW: 1920, resH: 1200 },
    { id: 'hp_17_fhd', brandId: 'hp', name: 'HP 17 / Pavilion 17 / Envy 17 (17,3" Full HD 1920×1080)', desc: '17,3" • 1920×1080 • 127.3 PPI', diagInch: 17.3, resW: 1920, resH: 1080 },
    { id: 'hp_spectre_13', brandId: 'hp', name: 'HP Spectre x360 13 (13,3" Full HD 1920×1080)', desc: '13,3" • 1920×1080 • 165.6 PPI', diagInch: 13.3, resW: 1920, resH: 1080 },
    { id: 'hp_spectre_14_32', brandId: 'hp', name: 'HP Spectre x360 14 format 3:2 (13,5" 1920×1280)', desc: '13,5" • 1920×1280 • 170.8 PPI', diagInch: 13.5, resW: 1920, resH: 1280 },
    { id: 'hp_victus_omen_15', brandId: 'hp', name: 'HP Victus 15 / Omen 15 Gaming (15,6" Full HD 144Hz)', desc: '15,6" • 1920×1080 • 141.2 PPI', diagInch: 15.6, resW: 1920, resH: 1080 },

    // --- LENOVO ---
    { id: 'lenovo_ideapad_15_fhd', brandId: 'lenovo', name: 'Lenovo IdeaPad 3 / IdeaPad 5 / V15 (15,6" Full HD) ⭐', desc: '15,6" • 1920×1080 • 141.2 PPI (Top vente grand public)', diagInch: 15.6, resW: 1920, resH: 1080, isDefault: true },
    { id: 'lenovo_thinkpad_t14_fhd', brandId: 'lenovo', name: 'Lenovo ThinkPad T14 / T480 / T490 / E14 (14,0" FHD) ⭐', desc: '14,0" • 1920×1080 • 157.4 PPI (Standard entreprise)', diagInch: 14.0, resW: 1920, resH: 1080 },
    { id: 'lenovo_thinkpad_t14_1610', brandId: 'lenovo', name: 'Lenovo ThinkPad T14 Gen 3/4 / X1 Carbon (14,0" 16:10 FHD+)', desc: '14,0" • 1920×1200 • 161.8 PPI', diagInch: 14.0, resW: 1920, resH: 1200 },
    { id: 'lenovo_thinkpad_x1_carbon_wqhd', brandId: 'lenovo', name: 'Lenovo ThinkPad X1 Carbon WQHD (14,0" 2560×1440)', desc: '14,0" • 2560×1440 • 209.8 PPI', diagInch: 14.0, resW: 2560, resH: 1440 },
    { id: 'lenovo_thinkpad_t15_fhd', brandId: 'lenovo', name: 'Lenovo ThinkPad T15 / T580 / T590 / E15 (15,6" FHD)', desc: '15,6" • 1920×1080 • 141.2 PPI', diagInch: 15.6, resW: 1920, resH: 1080 },
    { id: 'lenovo_thinkpad_t16_1610', brandId: 'lenovo', name: 'Lenovo ThinkPad T16 / IdeaPad 5 Pro 16 (16,0" 16:10 FHD+)', desc: '16,0" • 1920×1200 • 141.6 PPI', diagInch: 16.0, resW: 1920, resH: 1200 },
    { id: 'lenovo_ideapad_17_fhd', brandId: 'lenovo', name: 'Lenovo IdeaPad 3 17 / V17 (17,3" Full HD 1920×1080)', desc: '17,3" • 1920×1080 • 127.3 PPI', diagInch: 17.3, resW: 1920, resH: 1080 },
    { id: 'lenovo_yoga_slim_7_oled', brandId: 'lenovo', name: 'Lenovo Yoga 7 / 9 / Slim 7 OLED 2.8K (14,0" 2880×1800)', desc: '14,0" • 2880×1800 • 242.7 PPI', diagInch: 14.0, resW: 2880, resH: 1800 },
    { id: 'lenovo_legion_5_15', brandId: 'lenovo', name: 'Lenovo Legion 5 / LOQ 15 Gaming (15,6" Full HD)', desc: '15,6" • 1920×1080 • 141.2 PPI', diagInch: 15.6, resW: 1920, resH: 1080 },
    { id: 'lenovo_legion_5_pro_16', brandId: 'lenovo', name: 'Lenovo Legion 5 Pro / 7 (16,0" 16:10 WQXGA 2560×1600)', desc: '16,0" • 2560×1600 • 188.7 PPI', diagInch: 16.0, resW: 2560, resH: 1600 },

    // --- DELL ---
    { id: 'dell_inspiron_15_fhd', brandId: 'dell', name: 'Dell Inspiron 15 (séries 3000 / 5000 / 3511 / 3520) (15,6" FHD) ⭐', desc: '15,6" • 1920×1080 • 141.2 PPI', diagInch: 15.6, resW: 1920, resH: 1080, isDefault: true },
    { id: 'dell_latitude_14_fhd', brandId: 'dell', name: 'Dell Latitude 5400 / 5410 / 5420 / 7400 (14,0" FHD) ⭐', desc: '14,0" • 1920×1080 • 157.4 PPI', diagInch: 14.0, resW: 1920, resH: 1080 },
    { id: 'dell_latitude_15_fhd', brandId: 'dell', name: 'Dell Latitude 5500 / 5510 / 5520 (15,6" Full HD)', desc: '15,6" • 1920×1080 • 141.2 PPI', diagInch: 15.6, resW: 1920, resH: 1080 },
    { id: 'dell_xps_13_fhd', brandId: 'dell', name: 'Dell XPS 13 (9343 à 9380 - 13,3" Full HD 1920×1080)', desc: '13,3" • 1920×1080 • 165.6 PPI', diagInch: 13.3, resW: 1920, resH: 1080 },
    { id: 'dell_xps_13_1610', brandId: 'dell', name: 'Dell XPS 13 (9300 à 9320 Plus - 13,4" 16:10 FHD+ 1920×1200)', desc: '13,4" • 1920×1200 • 169.1 PPI', diagInch: 13.4, resW: 1920, resH: 1200 },
    { id: 'dell_xps_13_4k', brandId: 'dell', name: 'Dell XPS 13 4K UHD+ (13,4" 16:10 3840×2400)', desc: '13,4" • 3840×2400 • 338.2 PPI', diagInch: 13.4, resW: 3840, resH: 2400 },
    { id: 'dell_xps_15_fhd', brandId: 'dell', name: 'Dell XPS 15 (9550 à 9530 - 15,6" Full HD 1920×1080 / 1920×1200)', desc: '15,6" • 1920×1080 • 141.2 PPI', diagInch: 15.6, resW: 1920, resH: 1080 },
    { id: 'dell_xps_15_4k', brandId: 'dell', name: 'Dell XPS 15 4K UHD / OLED (15,6" 3840×2160 ou 3456×2160)', desc: '15,6" • 3840×2160 • 282.4 PPI', diagInch: 15.6, resW: 3840, resH: 2160 },
    { id: 'dell_inspiron_14_fhd', brandId: 'dell', name: 'Dell Inspiron 14 (14,0" Full HD 1920×1080)', desc: '14,0" • 1920×1080 • 157.4 PPI', diagInch: 14.0, resW: 1920, resH: 1080 },
    { id: 'dell_inspiron_16_1610', brandId: 'dell', name: 'Dell Inspiron 16 / 16 Plus (16,0" 16:10 FHD+ 1920×1200)', desc: '16,0" • 1920×1200 • 141.6 PPI', diagInch: 16.0, resW: 1920, resH: 1200 },
    { id: 'dell_xps_17_1610', brandId: 'dell', name: 'Dell XPS 17 (9700 à 9730 - 17,0" 16:10 FHD+ 1920×1200)', desc: '17,0" • 1920×1200 • 132.9 PPI', diagInch: 17.0, resW: 1920, resH: 1200 },

    // --- ASUS ---
    { id: 'asus_vivobook_15_fhd', brandId: 'asus', name: 'ASUS VivoBook 15 / S15 / Pro 15 (15,6" Full HD) ⭐', desc: '15,6" • 1920×1080 • 141.2 PPI (Top vente Asus)', diagInch: 15.6, resW: 1920, resH: 1080, isDefault: true },
    { id: 'asus_zenbook_14_fhd', brandId: 'asus', name: 'ASUS ZenBook 14 (UX430, UX425, UX434 - 14,0" Full HD) ⭐', desc: '14,0" • 1920×1080 • 157.4 PPI', diagInch: 14.0, resW: 1920, resH: 1080 },
    { id: 'asus_zenbook_14_oled', brandId: 'asus', name: 'ASUS ZenBook 14 OLED (UX3402, UX3405 - 14,0" 16:10 2.8K)', desc: '14,0" • 2880×1800 • 242.7 PPI', diagInch: 14.0, resW: 2880, resH: 1800 },
    { id: 'asus_zenbook_13_fhd', brandId: 'asus', name: 'ASUS ZenBook 13 (UX330, UX331, UX325 - 13,3" Full HD)', desc: '13,3" • 1920×1080 • 165.6 PPI', diagInch: 13.3, resW: 1920, resH: 1080 },
    { id: 'asus_vivobook_14_fhd', brandId: 'asus', name: 'ASUS VivoBook 14 / E410 (14,0" Full HD 1920×1080)', desc: '14,0" • 1920×1080 • 157.4 PPI', diagInch: 14.0, resW: 1920, resH: 1080 },
    { id: 'asus_vivobook_16_1610', brandId: 'asus', name: 'ASUS VivoBook 16 (16,0" 16:10 FHD+ 1920×1200)', desc: '16,0" • 1920×1200 • 141.6 PPI', diagInch: 16.0, resW: 1920, resH: 1200 },
    { id: 'asus_tuf_rog_15_fhd', brandId: 'asus', name: 'ASUS TUF Gaming F15 / ROG Strix G15 (15,6" Full HD 144Hz)', desc: '15,6" • 1920×1080 • 141.2 PPI', diagInch: 15.6, resW: 1920, resH: 1080 },
    { id: 'asus_rog_zephyrus_g14', brandId: 'asus', name: 'ASUS ROG Zephyrus G14 (14,0" QHD 2560×1440)', desc: '14,0" • 2560×1440 • 209.8 PPI', diagInch: 14.0, resW: 2560, resH: 1440 },
    { id: 'asus_tuf_vivobook_17_fhd', brandId: 'asus', name: 'ASUS TUF Gaming 17 / VivoBook 17 (17,3" Full HD 1920×1080)', desc: '17,3" • 1920×1080 • 127.3 PPI', diagInch: 17.3, resW: 1920, resH: 1080 },

    // --- ACER ---
    { id: 'acer_aspire_5_15_fhd', brandId: 'acer', name: 'Acer Aspire 5 / Aspire 3 (15,6" Full HD 1920×1080) ⭐', desc: '15,6" • 1920×1080 • 141.2 PPI (N°1 des ventes Acer)', diagInch: 15.6, resW: 1920, resH: 1080, isDefault: true },
    { id: 'acer_aspire_3_15_hd', brandId: 'acer', name: 'Acer Aspire 3 entrée de gamme (15,6" HD 1366×768)', desc: '15,6" • 1366×768 • 100.5 PPI', diagInch: 15.6, resW: 1366, resH: 768 },
    { id: 'acer_swift_3_14_fhd', brandId: 'acer', name: 'Acer Swift 3 / Swift Go 14 (14,0" Full HD 1920×1080) ⭐', desc: '14,0" • 1920×1080 • 157.4 PPI', diagInch: 14.0, resW: 1920, resH: 1080 },
    { id: 'acer_swift_go_14_oled', brandId: 'acer', name: 'Acer Swift Go 14 OLED (14,0" 16:10 2.8K 2880×1800)', desc: '14,0" • 2880×1800 • 242.7 PPI', diagInch: 14.0, resW: 2880, resH: 1800 },
    { id: 'acer_swift_3_13_32', brandId: 'acer', name: 'Acer Swift 3 13,5" format 3:2 (13,5" 2256×1504)', desc: '13,5" • 2256×1504 • 201.2 PPI', diagInch: 13.5, resW: 2256, resH: 1504 },
    { id: 'acer_aspire_17_fhd', brandId: 'acer', name: 'Acer Aspire 3 17 / Aspire 5 17 (17,3" Full HD 1920×1080)', desc: '17,3" • 1920×1080 • 127.3 PPI', diagInch: 17.3, resW: 1920, resH: 1080 },
    { id: 'acer_nitro_5_15', brandId: 'acer', name: 'Acer Nitro 5 / Predator Helios (15,6" Full HD 144Hz)', desc: '15,6" • 1920×1080 • 141.2 PPI', diagInch: 15.6, resW: 1920, resH: 1080 },
    { id: 'acer_chromebook_14_15', brandId: 'acer', name: 'Acer Chromebook 314 / 315 / 514 (14,0" ou 15,6" FHD)', desc: '14,0"/15,6" • 1920×1080 • ~141 à 157 PPI', diagInch: 15.6, resW: 1920, resH: 1080 },

    // --- MONITEURS FIXES (DELL, HP, SAMSUNG, LG, ASUS, PHILIPS, IIYAMA...) ---
    { id: 'mon_21_fhd', brandId: 'monitors', name: 'Moniteur 21,5" Full HD (1920×1080)', desc: '21,5" • 1920×1080 • 102.5 PPI', diagInch: 21.5, resW: 1920, resH: 1080 },
    { id: 'mon_24_fhd', brandId: 'monitors', name: 'Moniteur 23,8" / 24,0" Full HD (1920×1080) ⭐ Standard bureau', desc: '24,0" • 1920×1080 • 91.8 PPI (Le standard universel)', diagInch: 24.0, resW: 1920, resH: 1080, isDefault: true },
    { id: 'mon_24_1610', brandId: 'monitors', name: 'Moniteur 24,0" format 16:10 (1920×1200 Dell UltraSharp, HP...)', desc: '24,0" • 1920×1200 • 94.3 PPI', diagInch: 24.0, resW: 1920, resH: 1200 },
    { id: 'mon_27_fhd', brandId: 'monitors', name: 'Moniteur 27,0" Full HD (1920×1080)', desc: '27,0" • 1920×1080 • 81.6 PPI', diagInch: 27.0, resW: 1920, resH: 1080 },
    { id: 'mon_27_qhd', brandId: 'monitors', name: 'Moniteur 27,0" QHD (2560×1440) ⭐ Standard pro / graphisme', desc: '27,0" • 2560×1440 • 108.8 PPI', diagInch: 27.0, resW: 2560, resH: 1440 },
    { id: 'mon_27_4k', brandId: 'monitors', name: 'Moniteur 27,0" 4K UHD (3840×2160)', desc: '27,0" • 3840×2160 • 163.2 PPI', diagInch: 27.0, resW: 3840, resH: 2160 },
    { id: 'mon_32_4k', brandId: 'monitors', name: 'Moniteur 31,5" / 32,0" 4K UHD (3840×2160)', desc: '32,0" • 3840×2160 • 137.7 PPI', diagInch: 32.0, resW: 3840, resH: 2160 },
    { id: 'mon_34_ultrawide', brandId: 'monitors', name: 'Moniteur 34,0" UltraWide 21:9 (3440×1440 incurvé)', desc: '34,0" • 3440×1440 • 109.7 PPI', diagInch: 34.0, resW: 3440, resH: 1440 },

    // --- GÉNÉRIQUE ---
    { id: 'standard_96', brandId: 'generic', name: 'Écran standard générique web (96 DPI non étalonné)', desc: '96.0 PPI théorique', diagInch: null, forcedPpi: 96, isDefault: true }
  ];

  class ScreenCalibManager {
    constructor() {
      this.currentMode = 'preset'; // 'preset' | 'custom' | 'card'
      this.selectedBrandId = 'hp';
      this.activeCalib = this.loadCalibration();
      this.tempCalib = { ...this.activeCalib };
      if (this.activeCalib && this.activeCalib.brandId) {
        this.selectedBrandId = this.activeCalib.brandId;
      }
    }

    /**
     * Charge le profil enregistré ou crée un profil par défaut
     */
    loadCalibration() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.cssPxPerCm === 'number' && parsed.cssPxPerCm > 10) {
            return parsed;
          }
        }
      } catch (_) {}

      // Profil par défaut (non étalonné)
      return {
        type: 'preset',
        brandId: 'generic',
        presetId: 'standard_96',
        name: 'Standard Web (96 DPI)',
        cssPxPerCm: 37.795275,
        isCalibrated: false
      };
    }

    /**
     * Sauvegarde le profil actuel
     */
    saveCalibration(calib) {
      this.activeCalib = { ...calib };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.activeCalib));
      } catch (_) {}

      if (window.MapManagerInstance) {
        window.MapManagerInstance._screenCalib = this.activeCalib;
        window.MapManagerInstance.updateMapHud();
      }

      if (window.App && typeof window.App.showToast === 'function') {
        const msg = this.activeCalib.isCalibrated
          ? `📏 Écran étalonné : ${this.activeCalib.name}. 1 cm sur la vitre = mesure exacte !`
          : `📏 Étalonnage réinitialisé (96 DPI standard).`;
        window.App.showToast(msg, "success");
      }
    }

    /**
     * Calcule le nombre de CSS pixels par cm pour un preset
     */
    computeCssPxPerCmForPreset(preset) {
      const dpr = window.devicePixelRatio || 1;
      let ppi = 96;

      if (preset.forcedPpi) {
        ppi = preset.forcedPpi;
      } else if (preset.diagInch && preset.resW && preset.resH) {
        const diagPx = Math.sqrt(preset.resW * preset.resW + preset.resH * preset.resH);
        ppi = diagPx / preset.diagInch;
      }

      // Nombre de pixels physiques par cm = ppi / 2.54
      // Nombre de pixels CSS par cm = pixels physiques / dpr
      const cssPxPerCm = ppi / (2.54 * dpr);
      return cssPxPerCm;
    }

    /**
     * Calcule le nombre de CSS pixels par cm pour une diagonale personnalisée
     */
    computeCssPxPerCmForCustom(diagInch) {
      const dpr = window.devicePixelRatio || 1;
      const screenW = window.screen.width * dpr;
      const screenH = window.screen.height * dpr;
      const diagPx = Math.sqrt(screenW * screenW + screenH * screenH);
      const ppi = diagPx / diagInch;
      return ppi / (2.54 * dpr);
    }

    /**
     * Calcule le nombre de CSS pixels par cm à partir de la largeur d'une carte bancaire (85.60 mm = 8.56 cm)
     */
    computeCssPxPerCmForCardWidth(cardWidthCssPx) {
      return cardWidthCssPx / 8.56;
    }

    /**
     * Détecte le preset et la marque les plus probables selon l'environnement
     */
    suggestPreset() {
      const isMac = /Macintosh|Mac OS X/i.test(navigator.userAgent);
      const isIPad = /iPad/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      if (isIPad) {
        return {
          brandId: 'apple',
          model: SCREEN_MODELS.find(p => p.id === 'ipad_10_2') || SCREEN_MODELS[0]
        };
      }
      if (isMac) {
        return {
          brandId: 'apple',
          model: SCREEN_MODELS.find(p => p.id === 'mac_air_13_m1') || SCREEN_MODELS[0]
        };
      }

      // Sur Windows / PC : suggérer HP 15.6" Full HD par défaut
      return {
        brandId: 'hp',
        model: SCREEN_MODELS.find(p => p.id === 'hp_15_fhd') || SCREEN_MODELS[0]
      };
    }

    /**
     * Ouvre la boîte modale d'étalonnage
     */
    openModal() {
      const modal = document.getElementById('screen-calib-modal');
      if (!modal) return;

      this.tempCalib = { ...this.activeCalib };

      this.populateBrandAndModelDropdowns();
      this.setupEventListeners();
      this.updateRulerPreview();

      modal.classList.remove('hidden');
    }

    closeModal() {
      const modal = document.getElementById('screen-calib-modal');
      if (modal) modal.classList.add('hidden');
    }

    /**
     * Peuple le sélecteur de marque et le sélecteur de modèle en cascade
     */
    populateBrandAndModelDropdowns() {
      const selectBrand = document.getElementById('select-screen-brand');
      const selectModel = document.getElementById('select-screen-model');
      if (!selectBrand || !selectModel) return;

      // 1. Déterminer la marque active
      const suggested = this.suggestPreset();
      let activeBrandId = this.tempCalib.brandId || this.selectedBrandId || suggested.brandId;
      if (!SCREEN_BRANDS.some(b => b.id === activeBrandId)) {
        activeBrandId = suggested.brandId;
      }
      this.selectedBrandId = activeBrandId;

      // 2. Remplir le sélecteur de marque
      selectBrand.innerHTML = '';
      SCREEN_BRANDS.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.name;
        if (b.id === activeBrandId) {
          opt.selected = true;
        }
        selectBrand.appendChild(opt);
      });

      // 3. Remplir le sélecteur de modèle pour la marque active
      this.populateModelDropdown(activeBrandId);
    }

    populateModelDropdown(brandId) {
      const selectModel = document.getElementById('select-screen-model');
      if (!selectModel) return;

      selectModel.innerHTML = '';
      const models = SCREEN_MODELS.filter(m => m.brandId === brandId);

      let targetModelId = this.tempCalib.presetId;
      if (!models.some(m => m.id === targetModelId)) {
        const defaultModel = models.find(m => m.isDefault) || models[0];
        targetModelId = defaultModel ? defaultModel.id : null;
      }

      models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        if (m.id === targetModelId) {
          opt.selected = true;
        }
        selectModel.appendChild(opt);
      });

      this.updateModelSpecsBadge(targetModelId);
    }

    updateModelSpecsBadge(modelId) {
      const badge = document.getElementById('model-specs-badge');
      const specsText = document.getElementById('model-specs-text');
      const specsPpi = document.getElementById('model-specs-ppi');
      if (!badge) return;

      const model = SCREEN_MODELS.find(m => m.id === modelId);
      if (!model) {
        badge.classList.add('hidden');
        return;
      }

      badge.classList.remove('hidden');
      const dpr = window.devicePixelRatio || 1;
      let ppi = 96;
      if (model.forcedPpi) {
        ppi = model.forcedPpi;
      } else if (model.diagInch && model.resW && model.resH) {
        ppi = Math.sqrt(model.resW * model.resW + model.resH * model.resH) / model.diagInch;
      }

      if (specsText) {
        specsText.innerHTML = `<strong>${model.name.replace(' ⭐', '')}</strong> : ${model.desc || ''}`;
      }
      if (specsPpi) {
        specsPpi.textContent = `${ppi.toFixed(1)} PPI (DPR ${dpr.toFixed(1)}x)`;
      }
    }

    setupEventListeners() {
      if (this._hasBoundEvents) return;
      this._hasBoundEvents = true;

      // Onglets
      const tabPreset = document.getElementById('tab-calib-preset');
      const tabCustom = document.getElementById('tab-calib-custom');
      const tabCard = document.getElementById('tab-calib-card');

      const secPreset = document.getElementById('section-calib-preset');
      const secCustom = document.getElementById('section-calib-custom');
      const secCard = document.getElementById('section-calib-card');

      const setTab = (mode) => {
        this.currentMode = mode;
        const tabs = [
          { btn: tabPreset, sec: secPreset, active: mode === 'preset' },
          { btn: tabCustom, sec: secCustom, active: mode === 'custom' },
          { btn: tabCard, sec: secCard, active: mode === 'card' }
        ];

        tabs.forEach(t => {
          if (!t.btn || !t.sec) return;
          if (t.active) {
            t.btn.className = 'py-2 px-1 rounded-xl border-2 transition cursor-pointer border-emerald-600 bg-emerald-50 text-emerald-800 font-bold';
            t.sec.classList.remove('hidden');
          } else {
            t.btn.className = 'py-2 px-1 rounded-xl border-2 transition cursor-pointer border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium';
            t.sec.classList.add('hidden');
          }
        });

        this.recalculateTempFromCurrentMode();
      };

      if (tabPreset) tabPreset.addEventListener('click', () => setTab('preset'));
      if (tabCustom) tabCustom.addEventListener('click', () => setTab('custom'));
      if (tabCard) tabCard.addEventListener('click', () => setTab('card'));

      // Changement de Marque
      const selectBrand = document.getElementById('select-screen-brand');
      if (selectBrand) {
        selectBrand.addEventListener('change', () => {
          const brandId = selectBrand.value;
          this.selectedBrandId = brandId;
          this.populateModelDropdown(brandId);
          this.recalculateTempFromCurrentMode();
        });
      }

      // Changement de Modèle
      const selectModel = document.getElementById('select-screen-model');
      if (selectModel) {
        selectModel.addEventListener('change', () => {
          this.updateModelSpecsBadge(selectModel.value);
          this.recalculateTempFromCurrentMode();
        });
      }

      // Input custom
      const inputCustom = document.getElementById('input-custom-diag');
      if (inputCustom) {
        inputCustom.addEventListener('input', () => {
          this.recalculateTempFromCurrentMode();
        });
      }

      // Slider carte bancaire
      const sliderCard = document.getElementById('slider-calib-card');
      const cardBox = document.getElementById('calib-card-box');
      if (sliderCard) {
        sliderCard.addEventListener('input', () => {
          const w = parseFloat(sliderCard.value);
          if (cardBox) cardBox.style.width = `${w}px`;
          this.recalculateTempFromCurrentMode();
        });
      }

      // Boutons modal
      const btnClose = document.getElementById('btn-close-screen-calib');
      const btnCancel = document.getElementById('btn-cancel-screen-calib');
      const btnSave = document.getElementById('btn-save-screen-calib');
      const btnReset = document.getElementById('btn-reset-screen-calib');

      if (btnClose) btnClose.addEventListener('click', () => this.closeModal());
      if (btnCancel) btnCancel.addEventListener('click', () => this.closeModal());

      if (btnReset) {
        btnReset.addEventListener('click', () => {
          const defaultCalib = {
            type: 'preset',
            brandId: 'generic',
            presetId: 'standard_96',
            name: 'Standard Web (96 DPI)',
            cssPxPerCm: 37.795275,
            isCalibrated: false
          };
          this.saveCalibration(defaultCalib);
          this.closeModal();
        });
      }

      if (btnSave) {
        btnSave.addEventListener('click', () => {
          this.tempCalib.isCalibrated = (this.tempCalib.presetId !== 'standard_96');
          this.saveCalibration(this.tempCalib);
          this.closeModal();
        });
      }
    }

    recalculateTempFromCurrentMode() {
      if (this.currentMode === 'preset') {
        const selectBrand = document.getElementById('select-screen-brand');
        const selectModel = document.getElementById('select-screen-model');
        const brandId = selectBrand ? selectBrand.value : 'hp';
        const modelId = selectModel ? selectModel.value : 'hp_15_fhd';
        const preset = SCREEN_MODELS.find(p => p.id === modelId) || SCREEN_MODELS[0];
        const cssPxPerCm = this.computeCssPxPerCmForPreset(preset);

        this.tempCalib = {
          type: 'preset',
          brandId: brandId,
          presetId: preset.id,
          name: preset.name.replace(' ⭐', ''),
          cssPxPerCm: cssPxPerCm,
          isCalibrated: (preset.id !== 'standard_96'),
          diagInch: preset.diagInch,
          resW: preset.resW,
          resH: preset.resH
        };
      } else if (this.currentMode === 'custom') {
        const input = document.getElementById('input-custom-diag');
        const diag = parseFloat(input ? input.value : 15.6) || 15.6;
        const cssPxPerCm = this.computeCssPxPerCmForCustom(diag);

        this.tempCalib = {
          type: 'custom',
          diagInch: diag,
          name: `Écran ${diag}" personnalisé`,
          cssPxPerCm: cssPxPerCm,
          isCalibrated: true
        };
      } else if (this.currentMode === 'card') {
        const slider = document.getElementById('slider-calib-card');
        const cardWidthPx = parseFloat(slider ? slider.value : 323) || 323;
        const cssPxPerCm = this.computeCssPxPerCmForCardWidth(cardWidthPx);

        this.tempCalib = {
          type: 'card',
          cardWidthPx: cardWidthPx,
          name: 'Calibrage Carte Bancaire',
          cssPxPerCm: cssPxPerCm,
          isCalibrated: true
        };
      }

      this.updateRulerPreview();
    }

    /**
     * Génère le SVG de la réglette témoin de 5 cm avec graduations au millimètre
     */
    updateRulerPreview() {
      const container = document.getElementById('calib-ruler-container');
      const calcInfo = document.getElementById('calib-calc-info');
      if (!container) return;

      const pxPerCm = this.tempCalib.cssPxPerCm || 37.795275;
      const totalWidth = 5 * pxPerCm;

      if (calcInfo) {
        calcInfo.textContent = `1 cm = ${pxPerCm.toFixed(1)} px • 5 cm = ${Math.round(totalWidth)} px`;
      }

      let lines = '';
      for (let mm = 0; mm <= 50; mm++) {
        const x = mm * (pxPerCm / 10);
        let h = 8;
        let strokeWidth = 1;
        let label = '';

        if (mm % 10 === 0) {
          h = 24;
          strokeWidth = 2;
          const cmVal = mm / 10;
          const offsetX = (cmVal === 0 ? 3 : (cmVal === 5 ? -10 : -4));
          label = `<text x="${x + offsetX}" y="40" font-size="12" font-weight="900" fill="#0f172a" font-family="monospace">${cmVal}</text>`;
        } else if (mm % 5 === 0) {
          h = 16;
          strokeWidth = 1.5;
        }

        lines += `<line x1="${x.toFixed(2)}" y1="0" x2="${x.toFixed(2)}" y2="${h}" stroke="#1e293b" stroke-width="${strokeWidth}" />${label}`;
      }

      container.innerHTML = `
        <svg width="${Math.ceil(totalWidth) + 12}" height="48" style="display:block; overflow:visible; margin: 0 auto;">
          <rect x="0" y="0" width="${totalWidth.toFixed(2)}" height="48" fill="#fef3c7" stroke="#334155" stroke-width="1.5" rx="5" />
          ${lines}
          <text x="${(totalWidth / 2) - 12}" y="20" font-size="10" font-weight="bold" fill="#059669" font-family="sans-serif">cm</text>
        </svg>
      `;
    }
  }

  window.ScreenCalibManager = new ScreenCalibManager();
  window.SCREEN_BRANDS = SCREEN_BRANDS;
  window.SCREEN_MODELS = SCREEN_MODELS;
})();
