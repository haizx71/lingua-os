/**
 * Curated beginner lexicon (A0-B1) and pronunciation/structure assistance for zero-English learners.
 * Supplies reliable Vietnamese glosses, parts of speech, IPA phonetic hints, and Vietnamese stress/structure tips
 * for pilot reader content.
 */

export interface BeginnerWordEntry {
  readonly lemma: string;
  readonly posVi: string;
  readonly meaningVi: string;
  readonly ipa?: string;
  readonly pronTipVi?: string;
}

export const BEGINNER_LEXICON: Readonly<Record<string, BeginnerWordEntry>> = {
  // Pilot Story 1: A Quiet Cup of Tea & character names
  mina: {
    lemma: 'Mina',
    posVi: 'Danh từ riêng',
    meaningVi: 'Mina (tên riêng nữ)',
    ipa: '/ˈmiː.nə/',
    pronTipVi: 'Đọc nhẹ nhàng: MII-nờ',
  },
  visit: {
    lemma: 'visit',
    posVi: 'Động từ',
    meaningVi: 'thăm, ghé thăm',
    ipa: '/ˈvɪz.ɪt/',
    pronTipVi: 'Nhấn âm 1: VI-zit',
  },
  visits: {
    lemma: 'visit',
    posVi: 'Động từ',
    meaningVi: 'thăm, ghé thăm',
    ipa: '/ˈvɪz.ɪts/',
    pronTipVi: 'Nhấn âm 1: VI-zit, thêm âm s cuối',
  },
  her: {
    lemma: 'her',
    posVi: 'Đại từ',
    meaningVi: 'của cô ấy / bà ấy',
    ipa: '/hɜːr/',
    pronTipVi: 'Đọc uốn lưỡi nhẹ âm r',
  },
  grandmother: {
    lemma: 'grandmother',
    posVi: 'Danh từ',
    meaningVi: 'bà (nội/ngoại)',
    ipa: '/ˈɡræn.mʌð.ər/',
    pronTipVi: 'Nhấn âm 1: GRAN-ma-ờ',
  },
  every: {
    lemma: 'every',
    posVi: 'Tính từ',
    meaningVi: 'mỗi, mọi',
    ipa: '/ˈev.ri/',
    pronTipVi: 'Nhấn âm 1: EV-ri',
  },
  sunday: {
    lemma: 'Sunday',
    posVi: 'Danh từ',
    meaningVi: 'Chủ nhật',
    ipa: '/ˈsʌn.deɪ/',
    pronTipVi: 'Nhấn âm 1: SĂN-đây',
  },
  for: {
    lemma: 'for',
    posVi: 'Giới từ',
    meaningVi: 'để, cho, dành cho',
    ipa: '/fɔːr/',
    pronTipVi: 'Bật nhẹ âm f, uốn lưỡi âm r',
  },
  tea: {
    lemma: 'tea',
    posVi: 'Danh từ',
    meaningVi: 'trà',
    ipa: '/tiː/',
    pronTipVi: 'Đọc kéo dài âm i: TI',
  },
  live: {
    lemma: 'live',
    posVi: 'Động từ',
    meaningVi: 'sống, ở',
    ipa: '/lɪv/',
    pronTipVi: 'Âm i ngắn, kết thúc bằng âm v',
  },
  lives: {
    lemma: 'live',
    posVi: 'Động từ',
    meaningVi: 'sống, ở',
    ipa: '/lɪvz/',
    pronTipVi: 'Âm cuối đọc là vz',
  },
  in: {
    lemma: 'in',
    posVi: 'Giới từ',
    meaningVi: 'trong, ở trong',
    ipa: '/ɪn/',
    pronTipVi: 'Âm i ngắn nhẹ: in',
  },
  small: {
    lemma: 'small',
    posVi: 'Tính từ',
    meaningVi: 'nhỏ, bé',
    ipa: '/smɔːl/',
    pronTipVi: 'Chú ý âm ghép đầu sm-',
  },
  house: {
    lemma: 'house',
    posVi: 'Danh từ',
    meaningVi: 'ngôi nhà',
    ipa: '/haʊs/',
    pronTipVi: 'Bật nhẹ âm cuối -s',
  },
  beside: {
    lemma: 'beside',
    posVi: 'Giới từ',
    meaningVi: 'bên cạnh',
    ipa: '/bɪˈsaɪd/',
    pronTipVi: 'Nhấn âm 2: bi-SAI-đ',
  },
  park: {
    lemma: 'park',
    posVi: 'Danh từ',
    meaningVi: 'công viên',
    ipa: '/pɑːrk/',
    pronTipVi: 'Bật hơi p, âm a kéo dài',
  },
  kitchen: {
    lemma: 'kitchen',
    posVi: 'Danh từ',
    meaningVi: 'nhà bếp',
    ipa: '/ˈkɪtʃ.ən/',
    pronTipVi: 'Nhấn âm 1: KIT-chừn',
  },
  open: {
    lemma: 'open',
    posVi: 'Động từ',
    meaningVi: 'mở ra, thông ra',
    ipa: '/ˈəʊ.pən/',
    pronTipVi: 'Nhấn âm 1: ÔU-pần',
  },
  opens: {
    lemma: 'open',
    posVi: 'Động từ',
    meaningVi: 'mở ra, thông ra',
    ipa: '/ˈəʊ.pənz/',
    pronTipVi: 'Nhấn âm 1: ÔU-pần, kết thúc z',
  },
  bright: {
    lemma: 'bright',
    posVi: 'Tính từ',
    meaningVi: 'sáng sủa, tươi sáng',
    ipa: '/braɪt/',
    pronTipVi: 'Bật nhẹ âm br- đầu và -t cuối',
  },
  room: {
    lemma: 'room',
    posVi: 'Danh từ',
    meaningVi: 'căn phòng',
    ipa: '/ruːm/',
    pronTipVi: 'Âm u kéo dài: ruum',
  },
  with: {
    lemma: 'with',
    posVi: 'Giới từ',
    meaningVi: 'với, có',
    ipa: '/wɪð/',
    pronTipVi: 'Để đầu lưỡi giữa hai hàm răng cho âm th',
  },
  blue: {
    lemma: 'blue',
    posVi: 'Tính từ',
    meaningVi: 'màu xanh dương',
    ipa: '/bluː/',
    pronTipVi: 'Âm ghép bl- và u kéo dài: bluu',
  },
  table: {
    lemma: 'table',
    posVi: 'Danh từ',
    meaningVi: 'cái bàn',
    ipa: '/ˈteɪ.bəl/',
    pronTipVi: 'Nhấn âm 1: TÂY-bồ',
  },
  plan: {
    lemma: 'plan',
    posVi: 'Danh từ',
    meaningVi: 'dự định, kế hoạch',
    ipa: '/plæn/',
    pronTipVi: 'Âm ghép pl-, âm a bẹt',
  },
  plans: {
    lemma: 'plan',
    posVi: 'Danh từ',
    meaningVi: 'dự định, kế hoạch',
    ipa: '/plænz/',
    pronTipVi: 'Âm pl- và kết thúc -z',
  },
  share: {
    lemma: 'share',
    posVi: 'Động từ',
    meaningVi: 'chia sẻ, dùng chung',
    ipa: '/ʃeər/',
    pronTipVi: 'Âm sh chu môi, uốn lưỡi âm r',
  },
  old: {
    lemma: 'old',
    posVi: 'Tính từ',
    meaningVi: 'cũ, lớn tuổi',
    ipa: '/əʊld/',
    pronTipVi: 'Đọc âm ôu rồi cong lưỡi âm ld',
  },
  neighbor: {
    lemma: 'neighbor',
    posVi: 'Danh từ',
    meaningVi: 'hàng xóm',
    ipa: '/ˈneɪ.bər/',
    pronTipVi: 'Nhấn âm 1: NÂY-bờ',
  },
  town: {
    lemma: 'town',
    posVi: 'Danh từ',
    meaningVi: 'thị trấn, phố',
    ipa: '/taʊn/',
    pronTipVi: 'Âm ao kết thúc bằng n: taon',
  },
  love: {
    lemma: 'love',
    posVi: 'Động từ',
    meaningVi: 'yêu thích',
    ipa: '/lʌv/',
    pronTipVi: 'Âm á ngắn, răng trên chạm môi dưới âm v',
  },
  loves: {
    lemma: 'love',
    posVi: 'Động từ',
    meaningVi: 'yêu thích',
    ipa: '/lʌvz/',
    pronTipVi: 'Đọc lăvz',
  },
  talk: {
    lemma: 'talk',
    posVi: 'Động từ',
    meaningVi: 'cuộc trò chuyện, nói chuyện',
    ipa: '/tɔːk/',
    pronTipVi: 'Âm o dài, bật nhẹ âm k cuối',
  },
  talks: {
    lemma: 'talk',
    posVi: 'Động từ',
    meaningVi: 'cuộc trò chuyện, nói chuyện',
    ipa: '/tɔːks/',
    pronTipVi: 'Bật rõ âm ks cuối',
  },
  coat: {
    lemma: 'coat',
    posVi: 'Danh từ',
    meaningVi: 'áo khoác',
    ipa: '/kəʊt/',
    pronTipVi: 'Âm ôu, bật nhẹ âm t cuối',
  },
  shelf: {
    lemma: 'shelf',
    posVi: 'Danh từ',
    meaningVi: 'kệ, giá đỡ',
    ipa: '/ʃelf/',
    pronTipVi: 'Âm sh chu môi, kết thúc âm lf',
  },
  milk: {
    lemma: 'milk',
    posVi: 'Danh từ',
    meaningVi: 'sữa',
    ipa: '/mɪlk/',
    pronTipVi: 'Âm i ngắn, kết thúc lk',
  },
  sugar: {
    lemma: 'sugar',
    posVi: 'Danh từ',
    meaningVi: 'đường',
    ipa: '/ˈʃʊɡ.ər/',
    pronTipVi: 'Nhấn âm 1: SU-gờ',
  },
  cup: {
    lemma: 'cup',
    posVi: 'Danh từ',
    meaningVi: 'tách, cốc',
    ipa: '/kʌp/',
    pronTipVi: 'Âm á ngắn, mím môi bật p',
  },
  cups: {
    lemma: 'cup',
    posVi: 'Danh từ',
    meaningVi: 'tách, cốc',
    ipa: '/kʌps/',
    pronTipVi: 'Bật âm ps cuối',
  },
  tray: {
    lemma: 'tray',
    posVi: 'Danh từ',
    meaningVi: 'cái khay',
    ipa: '/treɪ/',
    pronTipVi: 'Âm ghép tr- và ei',
  },
  kettle: {
    lemma: 'kettle',
    posVi: 'Danh từ',
    meaningVi: 'ấm đun nước',
    ipa: '/ˈket.əl/',
    pronTipVi: 'Nhấn âm 1: KET-tồ',
  },
  stove: {
    lemma: 'stove',
    posVi: 'Danh từ',
    meaningVi: 'bếp nấu',
    ipa: '/stəʊv/',
    pronTipVi: 'Âm st- đầu và kết thúc bằng v',
  },
  leaf: {
    lemma: 'leaf',
    posVi: 'Danh từ',
    meaningVi: 'lá (cây)',
    ipa: '/liːf/',
    pronTipVi: 'Âm i kéo dài, kết thúc bằng f',
  },
  leaves: {
    lemma: 'leaf',
    posVi: 'Danh từ',
    meaningVi: 'lá (trà/cây), rời đi',
    ipa: '/liːvz/',
    pronTipVi: 'Âm i dài kết thúc vz',
  },
  spoon: {
    lemma: 'spoon',
    posVi: 'Danh từ',
    meaningVi: 'cái thìa, muỗng',
    ipa: '/spuːn/',
    pronTipVi: 'Âm sp- và u dài',
  },
  water: {
    lemma: 'water',
    posVi: 'Danh từ',
    meaningVi: 'nước',
    ipa: '/ˈwɔː.tər/',
    pronTipVi: 'Nhấn âm 1: QUO-tờ',
  },
  hot: {
    lemma: 'hot',
    posVi: 'Tính từ',
    meaningVi: 'nóng',
    ipa: '/hɒt/',
    pronTipVi: 'Âm o ngắn, bật âm t',
  },
  warm: {
    lemma: 'warm',
    posVi: 'Tính từ',
    meaningVi: 'ấm áp',
    ipa: '/wɔːm/',
    pronTipVi: 'Âm o dài tròn môi, kết thúc m',
  },
  fresh: {
    lemma: 'fresh',
    posVi: 'Tính từ',
    meaningVi: 'tươi mới, thanh mát',
    ipa: '/freʃ/',
    pronTipVi: 'Âm fr- và kết thúc bằng sh chu môi',
  },
  door: {
    lemma: 'door',
    posVi: 'Danh từ',
    meaningVi: 'cánh cửa',
    ipa: '/dɔːr/',
    pronTipVi: 'Âm o dài uốn lưỡi r',
  },
  umbrella: {
    lemma: 'umbrella',
    posVi: 'Danh từ',
    meaningVi: 'cái ô, dù',
    ipa: '/ʌmˈbrel.ə/',
    pronTipVi: 'Nhấn âm 2: ăm-BRE-lờ',
  },
  bag: {
    lemma: 'bag',
    posVi: 'Danh từ',
    meaningVi: 'túi xách, cặp',
    ipa: '/bæɡ/',
    pronTipVi: 'Âm a bẹt, kết thúc g nhẹ',
  },
  smile: {
    lemma: 'smile',
    posVi: 'Động từ',
    meaningVi: 'mỉm cười, nụ cười',
    ipa: '/smaɪl/',
    pronTipVi: 'Âm sm- và ai cong lưỡi l',
  },
  smiles: {
    lemma: 'smile',
    posVi: 'Động từ',
    meaningVi: 'mỉm cười, nụ cười',
    ipa: '/smaɪlz/',
    pronTipVi: 'Âm sm- và ai-lz',
  },
  photo: {
    lemma: 'photo',
    posVi: 'Danh từ',
    meaningVi: 'bức ảnh',
    ipa: '/ˈfəʊ.təʊ/',
    pronTipVi: 'Nhấn âm 1: FÔU-tôu',
  },
  window: {
    lemma: 'window',
    posVi: 'Danh từ',
    meaningVi: 'cửa sổ',
    ipa: '/ˈwɪn.dəʊ/',
    pronTipVi: 'Nhấn âm 1: UYN-đâu',
  },
  garden: {
    lemma: 'garden',
    posVi: 'Danh từ',
    meaningVi: 'khu vườn',
    ipa: '/ˈɡɑː.dən/',
    pronTipVi: 'Nhấn âm 1: GA-dần',
  },
  rain: {
    lemma: 'rain',
    posVi: 'Danh từ',
    meaningVi: 'cơn mưa',
    ipa: '/reɪn/',
    pronTipVi: 'Âm r và ei-n: rên',
  },
  book: {
    lemma: 'book',
    posVi: 'Danh từ',
    meaningVi: 'cuốn sách',
    ipa: '/bʊk/',
    pronTipVi: 'Âm u ngắn, bật âm k',
  },
  books: {
    lemma: 'book',
    posVi: 'Danh từ',
    meaningVi: 'cuốn sách',
    ipa: '/bʊks/',
    pronTipVi: 'Bật rõ âm ks cuối',
  },

  // Pilot Story 2: The Morning Bus to Work
  morning: {
    lemma: 'morning',
    posVi: 'Danh từ',
    meaningVi: 'buổi sáng',
    ipa: '/ˈmɔː.nɪŋ/',
    pronTipVi: 'Nhấn âm 1: MO-ninh',
  },
  breakfast: {
    lemma: 'breakfast',
    posVi: 'Danh từ',
    meaningVi: 'bữa sáng',
    ipa: '/ˈbrek.fəst/',
    pronTipVi: 'Nhấn âm 1: BREK-fợst',
  },
  bus: {
    lemma: 'bus',
    posVi: 'Danh từ',
    meaningVi: 'xe buýt',
    ipa: '/bʌs/',
    pronTipVi: 'Âm á ngắn, xì nhẹ s cuối',
  },
  street: {
    lemma: 'street',
    posVi: 'Danh từ',
    meaningVi: 'đường phố',
    ipa: '/striːt/',
    pronTipVi: 'Âm str- và i dài, bật t',
  },
  wake: {
    lemma: 'wake',
    posVi: 'Động từ',
    meaningVi: 'thức dậy',
    ipa: '/weɪk/',
    pronTipVi: 'Âm ei, bật k',
  },
  wakes: {
    lemma: 'wake',
    posVi: 'Động từ',
    meaningVi: 'thức dậy',
    ipa: '/weɪks/',
    pronTipVi: 'Âm ei, kết thúc ks',
  },
  early: {
    lemma: 'early',
    posVi: 'Trạng từ',
    meaningVi: 'sớm',
    ipa: '/ˈɜː.li/',
    pronTipVi: 'Nhấn âm 1: Ơ-li',
  },
  drink: {
    lemma: 'drink',
    posVi: 'Động từ',
    meaningVi: 'uống',
    ipa: '/drɪŋk/',
    pronTipVi: 'Âm dr- đầu và ng-k cuối',
  },
  drinks: {
    lemma: 'drink',
    posVi: 'Động từ',
    meaningVi: 'uống',
    ipa: '/drɪŋks/',
    pronTipVi: 'Âm dr- và ng-ks',
  },
  glass: {
    lemma: 'glass',
    posVi: 'Danh từ',
    meaningVi: 'cốc thủy tinh, ly',
    ipa: '/ɡlɑːs/',
    pronTipVi: 'Âm gl- và a dài, xì s',
  },
  seat: {
    lemma: 'seat',
    posVi: 'Danh từ',
    meaningVi: 'chỗ ngồi',
    ipa: '/siːt/',
    pronTipVi: 'Âm i dài, bật t',
  },
  sit: {
    lemma: 'sit',
    posVi: 'Động từ',
    meaningVi: 'ngồi',
    ipa: '/sɪt/',
    pronTipVi: 'Âm i ngắn, bật t',
  },
  sits: {
    lemma: 'sit',
    posVi: 'Động từ',
    meaningVi: 'ngồi',
    ipa: '/sɪts/',
    pronTipVi: 'Bật ts cuối',
  },
  stop: {
    lemma: 'stop',
    posVi: 'Động từ',
    meaningVi: 'dừng lại, điểm dừng',
    ipa: '/stɒp/',
    pronTipVi: 'Âm st- và bật p',
  },
  stops: {
    lemma: 'stop',
    posVi: 'Động từ',
    meaningVi: 'dừng lại, trạm dừng',
    ipa: '/stɒps/',
    pronTipVi: 'Âm st- và kết thúc ps',
  },
  wait: {
    lemma: 'wait',
    posVi: 'Động từ',
    meaningVi: 'chờ đợi',
    ipa: '/weɪt/',
    pronTipVi: 'Âm ei, bật t',
  },
  waiting: {
    lemma: 'wait',
    posVi: 'Động từ',
    meaningVi: 'đang chờ đợi',
    ipa: '/ˈweɪ.tɪŋ/',
    pronTipVi: 'Nhấn âm 1: QUÂY-tinh',
  },
  arrive: {
    lemma: 'arrive',
    posVi: 'Động từ',
    meaningVi: 'đến nơi',
    ipa: '/əˈraɪv/',
    pronTipVi: 'Nhấn âm 2: ờ-RAI-v',
  },
  arrives: {
    lemma: 'arrive',
    posVi: 'Động từ',
    meaningVi: 'đến nơi',
    ipa: '/əˈraɪvz/',
    pronTipVi: 'Nhấn âm 2: ờ-RAI-vz',
  },

  // Pilot Story 3: Making an Appointment
  coffee: {
    lemma: 'coffee',
    posVi: 'Danh từ',
    meaningVi: 'cà phê',
    ipa: '/ˈkɒf.i/',
    pronTipVi: 'Nhấn âm 1: CO-fi',
  },
  office: {
    lemma: 'office',
    posVi: 'Danh từ',
    meaningVi: 'văn phòng',
    ipa: '/ˈɒf.ɪs/',
    pronTipVi: 'Nhấn âm 1: O-fìs',
  },
  appointment: {
    lemma: 'appointment',
    posVi: 'Danh từ',
    meaningVi: 'cuộc hẹn',
    ipa: '/əˈpɔɪnt.mənt/',
    pronTipVi: 'Nhấn âm 2: ờ-POIN-mần',
  },
  available: {
    lemma: 'available',
    posVi: 'Tính từ',
    meaningVi: 'rảnh, có sẵn',
    ipa: '/əˈveɪ.lə.bəl/',
    pronTipVi: 'Nhấn âm 2: ờ-VÂY-lơ-bồ',
  },
  schedule: {
    lemma: 'schedule',
    posVi: 'Danh từ',
    meaningVi: 'lịch trình',
    ipa: '/ˈskedʒ.uːl/',
    pronTipVi: 'Nhấn âm 1: SKE-dù',
  },
  doctor: {
    lemma: 'doctor',
    posVi: 'Danh từ',
    meaningVi: 'bác sĩ',
    ipa: '/ˈdɒk.tər/',
    pronTipVi: 'Nhấn âm 1: ĐOK-tờ',
  },
  tomorrow: {
    lemma: 'tomorrow',
    posVi: 'Trạng từ',
    meaningVi: 'ngày mai',
    ipa: '/təˈmɒr.əʊ/',
    pronTipVi: 'Nhấn âm 2: tờ-MO-râu',
  },
  today: {
    lemma: 'today',
    posVi: 'Trạng từ',
    meaningVi: 'hôm nay',
    ipa: '/təˈdeɪ/',
    pronTipVi: 'Nhấn âm 2: tờ-ĐÂY',
  },
  first: {
    lemma: 'first',
    posVi: 'Tính từ',
    meaningVi: 'đầu tiên',
    ipa: '/fɜːst/',
    pronTipVi: 'Âm ơ kéo dài, kết thúc st',
  },
  second: {
    lemma: 'second',
    posVi: 'Tính từ',
    meaningVi: 'thứ hai',
    ipa: '/ˈsek.ənd/',
    pronTipVi: 'Nhấn âm 1: SE-kừnd',
  },
  meet: {
    lemma: 'meet',
    posVi: 'Động từ',
    meaningVi: 'gặp, gặp gỡ',
    ipa: '/miːt/',
    pronTipVi: 'Âm i dài, bật t',
  },
  meeting: {
    lemma: 'meet',
    posVi: 'Danh từ',
    meaningVi: 'cuộc họp, buổi gặp',
    ipa: '/ˈmiː.tɪŋ/',
    pronTipVi: 'Nhấn âm 1: MII-tinh',
  },
  afternoon: {
    lemma: 'afternoon',
    posVi: 'Danh từ',
    meaningVi: 'buổi chiều',
    ipa: '/ˌɑːf.təˈnuːn/',
    pronTipVi: 'Nhấn âm 3: af-tơ-NUUN',
  },
  call: {
    lemma: 'call',
    posVi: 'Động từ',
    meaningVi: 'gọi điện, gọi',
    ipa: '/kɔːl/',
    pronTipVi: 'Âm o dài, cong lưỡi l',
  },
  calls: {
    lemma: 'call',
    posVi: 'Động từ',
    meaningVi: 'gọi điện, gọi',
    ipa: '/kɔːlz/',
    pronTipVi: 'Âm o dài, lz',
  },
  please: {
    lemma: 'please',
    posVi: 'Từ đệm',
    meaningVi: 'làm ơn, xin vui lòng',
    ipa: '/pliːz/',
    pronTipVi: 'Âm pl- và i dài, kết thúc z',
  },
  thank: {
    lemma: 'thank',
    posVi: 'Động từ',
    meaningVi: 'cảm ơn',
    ipa: '/θæŋk/',
    pronTipVi: 'Âm th đầu đặt lưỡi giữa răng, ng-k',
  },
  thanks: {
    lemma: 'thank',
    posVi: 'Từ cảm thán',
    meaningVi: 'lời cảm ơn',
    ipa: '/θæŋks/',
    pronTipVi: 'Âm th đầu và kết thúc ngks',
  },
  yes: {
    lemma: 'yes',
    posVi: 'Thán từ',
    meaningVi: 'vâng, có, đúng',
    ipa: '/jes/',
    pronTipVi: 'Âm i-es',
  },
  no: {
    lemma: 'no',
    posVi: 'Thán từ',
    meaningVi: 'không',
    ipa: '/nəʊ/',
    pronTipVi: 'Âm n-ôu',
  },

  // Pilot Story 4: Coffee, Carefully Noticed
  quiet: {
    lemma: 'quiet',
    posVi: 'Tính từ',
    meaningVi: 'yên tĩnh, thanh bình',
    ipa: '/ˈkwaɪ.ət/',
    pronTipVi: 'Nhấn âm 1: QUAI-ợt',
  },
  carefully: {
    lemma: 'carefully',
    posVi: 'Trạng từ',
    meaningVi: 'cẩn thận, kỹ lưỡng',
    ipa: '/ˈkeə.fəl.i/',
    pronTipVi: 'Nhấn âm 1: KE-phơ-li',
  },
  notice: {
    lemma: 'notice',
    posVi: 'Động từ',
    meaningVi: 'nhận thấy, chú ý',
    ipa: '/ˈnəʊ.tɪs/',
    pronTipVi: 'Nhấn âm 1: NÔU-tìs',
  },
  noticed: {
    lemma: 'notice',
    posVi: 'Động từ',
    meaningVi: 'đã nhận thấy',
    ipa: '/ˈnəʊ.tɪst/',
    pronTipVi: 'Nhấn âm 1: NÔU-tìst',
  },
  time: {
    lemma: 'time',
    posVi: 'Danh từ',
    meaningVi: 'thời gian, lúc',
    ipa: '/taɪm/',
    pronTipVi: 'Âm ai và mím môi m',
  },
  work: {
    lemma: 'work',
    posVi: 'Danh từ',
    meaningVi: 'công việc, làm việc',
    ipa: '/wɜːk/',
    pronTipVi: 'Âm ơ dài, bật k',
  },
  listen: {
    lemma: 'listen',
    posVi: 'Động từ',
    meaningVi: 'lắng nghe',
    ipa: '/ˈlɪs.ən/',
    pronTipVi: 'Nhấn âm 1: LÍS-sừn (chữ t câm)',
  },
  listens: {
    lemma: 'listen',
    posVi: 'Động từ',
    meaningVi: 'lắng nghe',
    ipa: '/ˈlɪs.ənz/',
    pronTipVi: 'Nhấn âm 1: LÍS-sừnz',
  },
  look: {
    lemma: 'look',
    posVi: 'Động từ',
    meaningVi: 'nhìn, ngắm',
    ipa: '/lʊk/',
    pronTipVi: 'Âm u ngắn, bật k',
  },
  looks: {
    lemma: 'look',
    posVi: 'Động từ',
    meaningVi: 'nhìn, ngắm',
    ipa: '/lʊks/',
    pronTipVi: 'Bật ks cuối',
  },
  see: {
    lemma: 'see',
    posVi: 'Động từ',
    meaningVi: 'nhìn thấy, thấy',
    ipa: '/siː/',
    pronTipVi: 'Âm i kéo dài: sii',
  },
  sees: {
    lemma: 'see',
    posVi: 'Động từ',
    meaningVi: 'nhìn thấy, thấy',
    ipa: '/siːz/',
    pronTipVi: 'Âm i dài và z',
  },

  // Pilot Story 5: Water Along the Hill Path
  walk: {
    lemma: 'walk',
    posVi: 'Động từ',
    meaningVi: 'đi bộ',
    ipa: '/wɔːk/',
    pronTipVi: 'Âm o kéo dài, bật âm k',
  },
  walks: {
    lemma: 'walk',
    posVi: 'Động từ',
    meaningVi: 'đi bộ',
    ipa: '/wɔːks/',
    pronTipVi: 'Âm o kéo dài, kết thúc ks',
  },
  path: {
    lemma: 'path',
    posVi: 'Danh từ',
    meaningVi: 'con đường nhỏ, lối mòn',
    ipa: '/pɑːθ/',
    pronTipVi: 'Âm a kéo dài, đặt lưỡi giữa răng âm th',
  },
  hill: {
    lemma: 'hill',
    posVi: 'Danh từ',
    meaningVi: 'ngọn đồi',
    ipa: '/hɪl/',
    pronTipVi: 'Âm i ngắn, uốn lưỡi âm l',
  },
  green: {
    lemma: 'green',
    posVi: 'Tính từ',
    meaningVi: 'màu xanh lá',
    ipa: '/ɡriːn/',
    pronTipVi: 'Âm gr- và i dài: griin',
  },
  tree: {
    lemma: 'tree',
    posVi: 'Danh từ',
    meaningVi: 'cây cối',
    ipa: '/triː/',
    pronTipVi: 'Âm tr- và i dài: trii',
  },
  trees: {
    lemma: 'tree',
    posVi: 'Danh từ',
    meaningVi: 'những cái cây',
    ipa: '/triːz/',
    pronTipVi: 'Âm triiz',
  },
  bird: {
    lemma: 'bird',
    posVi: 'Danh từ',
    meaningVi: 'con chim',
    ipa: '/bɜːd/',
    pronTipVi: 'Âm ơ dài uốn lưỡi, bật d',
  },
  birds: {
    lemma: 'bird',
    posVi: 'Danh từ',
    meaningVi: 'những con chim',
    ipa: '/bɜːdz/',
    pronTipVi: 'Âm ơ dài, dz',
  },
  sound: {
    lemma: 'sound',
    posVi: 'Danh từ',
    meaningVi: 'âm thanh, tiếng',
    ipa: '/saʊnd/',
    pronTipVi: 'Âm ao-nd',
  },
  sounds: {
    lemma: 'sound',
    posVi: 'Danh từ',
    meaningVi: 'âm thanh, nghe có vẻ',
    ipa: '/saʊndz/',
    pronTipVi: 'Âm ao-ndz',
  },
  step: {
    lemma: 'step',
    posVi: 'Danh từ',
    meaningVi: 'bước chân, bậc thang',
    ipa: '/step/',
    pronTipVi: 'Âm st- và e, bật p',
  },
  steps: {
    lemma: 'step',
    posVi: 'Danh từ',
    meaningVi: 'bước chân, bậc thang',
    ipa: '/steps/',
    pronTipVi: 'Bật ps cuối',
  },
  stone: {
    lemma: 'stone',
    posVi: 'Danh từ',
    meaningVi: 'hòn đá, phiến đá',
    ipa: '/stəʊn/',
    pronTipVi: 'Âm st- và ôun',
  },
  stones: {
    lemma: 'stone',
    posVi: 'Danh từ',
    meaningVi: 'những hòn đá',
    ipa: '/stəʊnz/',
    pronTipVi: 'Âm stôunz',
  },
  cool: {
    lemma: 'cool',
    posVi: 'Tính từ',
    meaningVi: 'mát mẻ, thanh mát',
    ipa: '/kuːl/',
    pronTipVi: 'Âm u dài, cong lưỡi l',
  },
  air: {
    lemma: 'air',
    posVi: 'Danh từ',
    meaningVi: 'không khí',
    ipa: '/eər/',
    pronTipVi: 'Âm e-ờ uốn lưỡi r',
  },
  breathe: {
    lemma: 'breathe',
    posVi: 'Động từ',
    meaningVi: 'hít thở',
    ipa: '/briːð/',
    pronTipVi: 'Âm br-, i dài và th rung',
  },
  calm: {
    lemma: 'calm',
    posVi: 'Tính từ',
    meaningVi: 'bình tĩnh, êm đềm',
    ipa: '/kɑːm/',
    pronTipVi: 'Âm a dài, chữ l câm, kết thúc m',
  },
  day: {
    lemma: 'day',
    posVi: 'Danh từ',
    meaningVi: 'ngày',
    ipa: '/deɪ/',
    pronTipVi: 'Âm ei: đêi',
  },
  friend: {
    lemma: 'friend',
    posVi: 'Danh từ',
    meaningVi: 'người bạn',
    ipa: '/frend/',
    pronTipVi: 'Âm fr-, e ngắn, bật d',
  },
  friends: {
    lemma: 'friend',
    posVi: 'Danh từ',
    meaningVi: 'những người bạn',
    ipa: '/frendz/',
    pronTipVi: 'Âm fr-, endz',
  },

  // Common Grammatical Particles and High-Frequency A0-A1 Words
  and: {
    lemma: 'and',
    posVi: 'Liên từ',
    meaningVi: 'và',
    ipa: '/ænd/',
    pronTipVi: 'Âm a bẹt, nd',
  },
  the: {
    lemma: 'the',
    posVi: 'Mạo từ',
    meaningVi: 'cái, người đó (xác định)',
    ipa: '/ðə/',
    pronTipVi: 'Đặt lưỡi giữa răng, đọc nhẹ dờ',
  },
  a: {
    lemma: 'a',
    posVi: 'Mạo từ',
    meaningVi: 'một (chưa xác định)',
    ipa: '/ə/',
    pronTipVi: 'Đọc nhẹ là ờ',
  },
  to: {
    lemma: 'to',
    posVi: 'Giới từ',
    meaningVi: 'đến, để',
    ipa: '/tuː/',
    pronTipVi: 'Đọc tu',
  },
  is: {
    lemma: 'be',
    posVi: 'Động từ',
    meaningVi: 'thì, là, ở',
    ipa: '/ɪz/',
    pronTipVi: 'Âm i ngắn, kết thúc z',
  },
  are: {
    lemma: 'be',
    posVi: 'Động từ',
    meaningVi: 'thì, là, ở (số nhiều)',
    ipa: '/ɑːr/',
    pronTipVi: 'Âm a dài uốn lưỡi r',
  },
  he: {
    lemma: 'he',
    posVi: 'Đại từ',
    meaningVi: 'anh ấy, ông ấy',
    ipa: '/hiː/',
    pronTipVi: 'Âm i dài: hii',
  },
  she: {
    lemma: 'she',
    posVi: 'Đại từ',
    meaningVi: 'cô ấy, bà ấy',
    ipa: '/ʃiː/',
    pronTipVi: 'Âm sh chu môi, i dài',
  },
  they: {
    lemma: 'they',
    posVi: 'Đại từ',
    meaningVi: 'họ, chúng nó',
    ipa: '/ðeɪ/',
    pronTipVi: 'Đặt lưỡi giữa răng, đọc đêi',
  },
  we: {
    lemma: 'we',
    posVi: 'Đại từ',
    meaningVi: 'chúng tôi, chúng ta',
    ipa: '/wiː/',
    pronTipVi: 'Âm u-i dài: quii',
  },
  i: {
    lemma: 'I',
    posVi: 'Đại từ',
    meaningVi: 'tôi',
    ipa: '/aɪ/',
    pronTipVi: 'Đọc rõ ai',
  },
  you: {
    lemma: 'you',
    posVi: 'Đại từ',
    meaningVi: 'bạn, các bạn',
    ipa: '/juː/',
    pronTipVi: 'Âm i-uu',
  },
  my: {
    lemma: 'my',
    posVi: 'Tính từ',
    meaningVi: 'của tôi',
    ipa: '/maɪ/',
    pronTipVi: 'Đọc rõ mai',
  },
  his: {
    lemma: 'his',
    posVi: 'Tính từ',
    meaningVi: 'của anh ấy',
    ipa: '/hɪz/',
    pronTipVi: 'Âm i ngắn, kết thúc z',
  },
};

const POS_VI_MAP: Readonly<Record<string, string>> = {
  noun: 'Danh từ',
  verb: 'Động từ',
  adjective: 'Tính từ',
  adverb: 'Trạng từ',
  preposition: 'Giới từ',
  pronoun: 'Đại từ',
  conjunction: 'Liên từ',
  phrase: 'Cụm từ',
};

/**
 * Look up a word or token in the curated beginner lexicon.
 * Normalizes punctuation and lowercases, with fallback stem matching for plurals and conjugations.
 */
export function lookupBeginnerWord(rawWord: string): BeginnerWordEntry | null {
  if (!rawWord) {
    return null;
  }
  const normalized = rawWord.toLowerCase().replace(/[^a-z']/g, '');
  if (!normalized) {
    return null;
  }

  const direct = BEGINNER_LEXICON[normalized];
  if (direct) {
    return direct;
  }

  // Trailing 's
  if (normalized.endsWith("'s") && normalized.length > 2) {
    const stem = normalized.slice(0, -2);
    if (BEGINNER_LEXICON[stem]) {
      return BEGINNER_LEXICON[stem];
    }
  }

  // Trailing -ing
  if (normalized.endsWith('ing') && normalized.length > 4) {
    const stem1 = normalized.slice(0, -3);
    if (BEGINNER_LEXICON[stem1]) {
      return BEGINNER_LEXICON[stem1];
    }
    const stem2 = `${stem1}e`;
    if (BEGINNER_LEXICON[stem2]) {
      return BEGINNER_LEXICON[stem2];
    }
  }

  // Trailing -ed
  if (normalized.endsWith('ed') && normalized.length > 3) {
    const stem1 = normalized.slice(0, -2);
    if (BEGINNER_LEXICON[stem1]) {
      return BEGINNER_LEXICON[stem1];
    }
    const stem2 = normalized.slice(0, -1);
    if (BEGINNER_LEXICON[stem2]) {
      return BEGINNER_LEXICON[stem2];
    }
  }

  // Trailing -ies
  if (normalized.endsWith('ies') && normalized.length > 3) {
    const stem = `${normalized.slice(0, -3)}y`;
    if (BEGINNER_LEXICON[stem]) {
      return BEGINNER_LEXICON[stem];
    }
  }

  // Trailing -es
  if (normalized.endsWith('es') && normalized.length > 3) {
    const stem1 = normalized.slice(0, -2);
    if (BEGINNER_LEXICON[stem1]) {
      return BEGINNER_LEXICON[stem1];
    }
    const stem2 = normalized.slice(0, -1);
    if (BEGINNER_LEXICON[stem2]) {
      return BEGINNER_LEXICON[stem2];
    }
  }

  // Trailing -s (excluding double s like pass, glass)
  if (normalized.endsWith('s') && !normalized.endsWith('ss') && normalized.length > 2) {
    const stem = normalized.slice(0, -1);
    if (BEGINNER_LEXICON[stem]) {
      return BEGINNER_LEXICON[stem];
    }
  }

  return null;
}

/**
 * Format a part of speech code into a beginner-friendly Vietnamese label.
 */
export function formatBeginnerPosVi(pos?: string): string | null {
  if (!pos) {
    return null;
  }
  const key = pos.trim().toLowerCase();
  return POS_VI_MAP[key] ?? pos;
}

/**
 * Get a tailored Vietnamese pronunciation and stress tip for a term.
 */
export function getVietnamesePronunciationTip(term: string, ipa?: string): string {
  const entry = lookupBeginnerWord(term);
  if (entry?.pronTipVi) {
    return entry.pronTipVi;
  }
  if (ipa && ipa.includes('ˈ')) {
    return `Chú ý nhấn trọng âm ở phần sau dấu ˈ trong ${ipa}`;
  }
  return 'Nghe mẫu phát âm và đọc chậm rõ âm cuối';
}

/**
 * Provide a single-sentence structural clue in Vietnamese for beginners deciphering a sentence.
 */
export function getSentenceStructureTip(sentenceText: string): string {
  const text = sentenceText ?? '';
  if (/["“"”]/.test(text)) {
    return 'Câu thoại trực tiếp: Phần trong ngoặc kép là lời nhân vật nói, theo sau bởi chủ ngữ và động từ tường thuật (says / asks).';
  }
  if (/(?:,\s*(?:and|but|so)\b)/i.test(text)) {
    return 'Câu ghép nối bằng liên từ (and / but / so): Chia câu thành 2 ý nhỏ trước và sau dấu phẩy để dịch lần lượt.';
  }
  if (/\b(?:because|while|when|after|before)\b/i.test(text)) {
    return 'Câu có mệnh đề thời gian / nguyên nhân (when / while / because / after): Xác định hành động chính trước, bối cảnh sau.';
  }
  return 'Cấu trúc câu chuẩn (Chủ ngữ + Động từ + Cụm bổ ngữ): Dịch từ người/vật thực hiện hành động sang hành động chính và nơi chốn/thời gian.';
}
