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
    posVi: 'Động từ',
    meaningVi: 'làm việc, công việc',
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
    posVi: 'Động từ',
    meaningVi: 'bước đi, dẫm chân, bước chân',
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

  // High-Frequency Beginner Base Verbs
  go: {
    lemma: 'go',
    posVi: 'Động từ',
    meaningVi: 'đi, di chuyển',
    ipa: '/ɡəʊ/',
    pronTipVi: 'Âm g và ôu: gôu',
  },
  come: {
    lemma: 'come',
    posVi: 'Động từ',
    meaningVi: 'đến, tới',
    ipa: '/kʌm/',
    pronTipVi: 'Âm k-ă-m: căm',
  },
  feel: {
    lemma: 'feel',
    posVi: 'Động từ',
    meaningVi: 'cảm thấy, cảm giác',
    ipa: '/fiːl/',
    pronTipVi: 'Âm f, i dài và cong lưỡi l: fiil',
  },
  eat: {
    lemma: 'eat',
    posVi: 'Động từ',
    meaningVi: 'ăn',
    ipa: '/iːt/',
    pronTipVi: 'Âm i dài, bật t cuối: iit',
  },
  say: {
    lemma: 'say',
    posVi: 'Động từ',
    meaningVi: 'nói, bảo',
    ipa: '/seɪ/',
    pronTipVi: 'Âm s và ei: sêi',
  },
  have: {
    lemma: 'have',
    posVi: 'Động từ',
    meaningVi: 'có, dùng',
    ipa: '/hæv/',
    pronTipVi: 'Âm h, a bẹt và kết thúc bằng v: hæv',
  },
  has: {
    lemma: 'have',
    posVi: 'Động từ',
    meaningVi: 'có, dùng (ngôi thứ 3 số ít)',
    ipa: '/hæz/',
    pronTipVi: 'Âm h, a bẹt và kết thúc bằng z',
  },
  do: {
    lemma: 'do',
    posVi: 'Động từ',
    meaningVi: 'làm, thực hiện',
    ipa: '/duː/',
    pronTipVi: 'Âm d và u dài: đu',
  },
  does: {
    lemma: 'do',
    posVi: 'Động từ',
    meaningVi: 'làm, thực hiện (ngôi thứ 3 số ít)',
    ipa: '/dʌz/',
    pronTipVi: 'Âm d và á-z: đăz',
  },
  take: {
    lemma: 'take',
    posVi: 'Động từ',
    meaningVi: 'cầm, lấy, mang theo',
    ipa: '/teɪk/',
    pronTipVi: 'Âm t, ei và bật nhẹ k: têik',
  },
  make: {
    lemma: 'make',
    posVi: 'Động từ',
    meaningVi: 'làm, tạo ra, pha chế',
    ipa: '/meɪk/',
    pronTipVi: 'Âm m, ei và bật nhẹ k: mêik',
  },
  find: {
    lemma: 'find',
    posVi: 'Động từ',
    meaningVi: 'tìm thấy, nhận ra',
    ipa: '/faɪnd/',
    pronTipVi: 'Âm f, ai và kết thúc nd: faind',
  },
  tell: {
    lemma: 'tell',
    posVi: 'Động từ',
    meaningVi: 'kể, bảo, nói với',
    ipa: '/tel/',
    pronTipVi: 'Âm t, e và cong lưỡi l: tel',
  },
  know: {
    lemma: 'know',
    posVi: 'Động từ',
    meaningVi: 'biết, hiểu',
    ipa: '/nəʊ/',
    pronTipVi: 'Chữ k câm, đọc n-ôu: nôu',
  },
  think: {
    lemma: 'think',
    posVi: 'Động từ',
    meaningVi: 'nghĩ, suy nghĩ',
    ipa: '/θɪŋk/',
    pronTipVi: 'Đặt lưỡi giữa răng âm th, kết thúc ngk',
  },
  leave: {
    lemma: 'leave',
    posVi: 'Động từ',
    meaningVi: 'rời đi, để lại',
    ipa: '/liːv/',
    pronTipVi: 'Âm l, i dài và kết thúc v: liiv',
  },
  give: {
    lemma: 'give',
    posVi: 'Động từ',
    meaningVi: 'cho, đưa, tặng',
    ipa: '/ɡɪv/',
    pronTipVi: 'Âm g, i ngắn và kết thúc v: giv',
  },
  keep: {
    lemma: 'keep',
    posVi: 'Động từ',
    meaningVi: 'giữ, tiếp tục',
    ipa: '/kiːp/',
    pronTipVi: 'Âm k, i dài và mím môi bật p: kiip',
  },
  stand: {
    lemma: 'stand',
    posVi: 'Động từ',
    meaningVi: 'đứng',
    ipa: '/stænd/',
    pronTipVi: 'Âm st- đầu, a bẹt và kết thúc nd: stænd',
  },
  hold: {
    lemma: 'hold',
    posVi: 'Động từ',
    meaningVi: 'cầm, nắm, giữ',
    ipa: '/həʊld/',
    pronTipVi: 'Âm h, ôu và kết thúc ld: hôuld',
  },
  put: {
    lemma: 'put',
    posVi: 'Động từ',
    meaningVi: 'đặt, để',
    ipa: '/pʊt/',
    pronTipVi: 'Âm p, u ngắn và bật t: put',
  },
  set: {
    lemma: 'set',
    posVi: 'Động từ',
    meaningVi: 'đặt, sắp xếp, chuẩn bị',
    ipa: '/set/',
    pronTipVi: 'Âm s, e ngắn và bật t: set',
  },
  read: {
    lemma: 'read',
    posVi: 'Động từ',
    meaningVi: 'đọc',
    ipa: '/riːd/',
    pronTipVi: 'Âm r, i dài và bật nhẹ d: riid',
  },
  write: {
    lemma: 'write',
    posVi: 'Động từ',
    meaningVi: 'viết',
    ipa: '/raɪt/',
    pronTipVi: 'Chữ w câm, âm r, ai và bật t: rait',
  },
  run: {
    lemma: 'run',
    posVi: 'Động từ',
    meaningVi: 'chạy',
    ipa: '/rʌn/',
    pronTipVi: 'Âm r và ă-n: răn',
  },
  bring: {
    lemma: 'bring',
    posVi: 'Động từ',
    meaningVi: 'mang lại, mang theo',
    ipa: '/brɪŋ/',
    pronTipVi: 'Âm br- đầu và kết thúc ng: brinh',
  },
  buy: {
    lemma: 'buy',
    posVi: 'Động từ',
    meaningVi: 'mua',
    ipa: '/baɪ/',
    pronTipVi: 'Âm b và ai: bai',
  },
  hear: {
    lemma: 'hear',
    posVi: 'Động từ',
    meaningVi: 'nghe thấy',
    ipa: '/hɪər/',
    pronTipVi: 'Âm h, i-ơ và uốn lưỡi r: hi-ờ',
  },
  get: {
    lemma: 'get',
    posVi: 'Động từ',
    meaningVi: 'nhận, có được, trở nên',
    ipa: '/ɡet/',
    pronTipVi: 'Âm g, e ngắn và bật t: get',
  },
  ask: {
    lemma: 'ask',
    posVi: 'Động từ',
    meaningVi: 'hỏi, yêu cầu',
    ipa: '/ɑːsk/',
    pronTipVi: 'Âm a dài và xì s-k: aask',
  },
  fall: {
    lemma: 'fall',
    posVi: 'Động từ',
    meaningVi: 'rơi, ngã',
    ipa: '/fɔːl/',
    pronTipVi: 'Âm f, o dài và cong lưỡi l: fool',
  },
  laugh: {
    lemma: 'laugh',
    posVi: 'Động từ',
    meaningVi: 'cười, cười lớn',
    ipa: '/lɑːf/',
    pronTipVi: 'Âm l, a dài và kết thúc bằng f: laaf',
  },
  sweep: {
    lemma: 'sweep',
    posVi: 'Động từ',
    meaningVi: 'quét (nhà)',
    ipa: '/swiːp/',
    pronTipVi: 'Âm sw- đầu, i dài và mím môi bật p: swiip',
  },
  pour: {
    lemma: 'pour',
    posVi: 'Động từ',
    meaningVi: 'rót, đổ (nước)',
    ipa: '/pɔːr/',
    pronTipVi: 'Âm p, o dài và uốn lưỡi r: poor',
  },
  smell: {
    lemma: 'smell',
    posVi: 'Động từ',
    meaningVi: 'ngửi thấy, có mùi thơm',
    ipa: '/smel/',
    pronTipVi: 'Âm sm- đầu, e và cong lưỡi l: smel',
  },
  hug: {
    lemma: 'hug',
    posVi: 'Động từ',
    meaningVi: 'ôm, ôm chặt',
    ipa: '/hʌɡ/',
    pronTipVi: 'Âm h, ă và kết thúc g nhẹ: hăg',
  },
  lift: {
    lemma: 'lift',
    posVi: 'Động từ',
    meaningVi: 'nâng lên, nhấc lên',
    ipa: '/lɪft/',
    pronTipVi: 'Âm l, i ngắn và kết thúc ft: lift',
  },
  clear: {
    lemma: 'clear',
    posVi: 'Động từ',
    meaningVi: 'dọn dẹp, làm sạch, làm sáng tỏ',
    ipa: '/klɪər/',
    pronTipVi: 'Âm kl- đầu, i-ơ và uốn lưỡi r: kli-ờ',
  },
  wash: {
    lemma: 'wash',
    posVi: 'Động từ',
    meaningVi: 'rửa, giặt',
    ipa: '/wɒʃ/',
    pronTipVi: 'Âm w, o ngắn và kết thúc sh chu môi: wosh',
  },
  nod: {
    lemma: 'nod',
    posVi: 'Động từ',
    meaningVi: 'gật đầu',
    ipa: '/nɒd/',
    pronTipVi: 'Âm n, o ngắn và bật d: nod',
  },
  pass: {
    lemma: 'pass',
    posVi: 'Động từ',
    meaningVi: 'chuyển qua, đi qua, vượt qua',
    ipa: '/pɑːs/',
    pronTipVi: 'Âm p, a dài và xì s: paas',
  },
  turn: {
    lemma: 'turn',
    posVi: 'Động từ',
    meaningVi: 'xoay, rẽ, quay lại',
    ipa: '/tɜːn/',
    pronTipVi: 'Âm t, ơ dài uốn lưỡi và n: tơn',
  },
  draw: {
    lemma: 'draw',
    posVi: 'Động từ',
    meaningVi: 'vẽ, kéo',
    ipa: '/drɔː/',
    pronTipVi: 'Âm dr- đầu và o dài tròn môi: droo',
  },
  add: {
    lemma: 'add',
    posVi: 'Động từ',
    meaningVi: 'thêm vào, cộng',
    ipa: '/æd/',
    pronTipVi: 'Âm a bẹt và bật nhẹ d: æd',
  },
  send: {
    lemma: 'send',
    posVi: 'Động từ',
    meaningVi: 'gửi đi',
    ipa: '/send/',
    pronTipVi: 'Âm s, e ngắn và kết thúc nd: send',
  },
};

export const IRREGULAR_VERB_MAP: Readonly<Record<string, { base: string; noteVi: string }>> = {
  went: { base: 'go', noteVi: 'Quá khứ của go (đi)' },
  gone: { base: 'go', noteVi: 'Quá khứ phân từ của go (đã đi / đã hết)' },
  drank: { base: 'drink', noteVi: 'Quá khứ của drink (uống)' },
  saw: { base: 'see', noteVi: 'Quá khứ của see (nhìn thấy)' },
  came: { base: 'come', noteVi: 'Quá khứ của come (đến)' },
  felt: { base: 'feel', noteVi: 'Quá khứ của feel (cảm thấy)' },
  ate: { base: 'eat', noteVi: 'Quá khứ của eat (ăn)' },
  said: { base: 'say', noteVi: 'Quá khứ của say (nói)' },
  had: { base: 'have', noteVi: 'Quá khứ của have (có / dùng)' },
  took: { base: 'take', noteVi: 'Quá khứ của take (lấy / cầm / mang)' },
  made: { base: 'make', noteVi: 'Quá khứ của make (làm / pha chế)' },
  found: { base: 'find', noteVi: 'Quá khứ của find (tìm thấy)' },
  sat: { base: 'sit', noteVi: 'Quá khứ của sit (ngồi)' },
  met: { base: 'meet', noteVi: 'Quá khứ của meet (gặp gỡ)' },
  told: { base: 'tell', noteVi: 'Quá khứ của tell (kể / bảo)' },
  knew: { base: 'know', noteVi: 'Quá khứ của know (biết)' },
  thought: { base: 'think', noteVi: 'Quá khứ của think (nghĩ)' },
  left: { base: 'leave', noteVi: 'Quá khứ của leave (rời đi / để lại)' },
  gave: { base: 'give', noteVi: 'Quá khứ của give (đưa / tặng)' },
  kept: { base: 'keep', noteVi: 'Quá khứ của keep (giữ)' },
  stood: { base: 'stand', noteVi: 'Quá khứ của stand (đứng)' },
  held: { base: 'hold', noteVi: 'Quá khứ của hold (cầm / giữ)' },
  wrote: { base: 'write', noteVi: 'Quá khứ của write (viết)' },
  ran: { base: 'run', noteVi: 'Quá khứ của run (chạy)' },
  brought: { base: 'bring', noteVi: 'Quá khứ của bring (mang theo)' },
  heard: { base: 'hear', noteVi: 'Quá khứ của hear (nghe thấy)' },
  got: { base: 'get', noteVi: 'Quá khứ của get (nhận / trở nên / xuống xe)' },
  woke: { base: 'wake', noteVi: 'Quá khứ của wake (thức dậy)' },
  bought: { base: 'buy', noteVi: 'Quá khứ của buy (mua)' },
  fell: { base: 'fall', noteVi: 'Quá khứ của fall (rơi / ngã)' },
  swept: { base: 'sweep', noteVi: 'Quá khứ của sweep (quét dọn)' },
  sent: { base: 'send', noteVi: 'Quá khứ của send (gửi)' },
  drew: { base: 'draw', noteVi: 'Quá khứ của draw (vẽ / kéo)' },
  did: { base: 'do', noteVi: 'Quá khứ của do (làm)' },
};

export const CONTRACTION_MAP: Readonly<Record<string, BeginnerWordEntry>> = {
  "don't": {
    lemma: "do not (don't)",
    posVi: 'Trợ động từ phủ định',
    meaningVi: 'không (viết tắt của do not)',
    ipa: '/dəʊnt/',
    pronTipVi: 'Đọc nối âm: ĐÔN-t',
  },
  "doesn't": {
    lemma: "does not (doesn't)",
    posVi: 'Trợ động từ phủ định',
    meaningVi: 'không (viết tắt của does not)',
    ipa: '/ˈdʌz.ənt/',
    pronTipVi: 'Nhấn âm 1: ĐẮZ-ừnt',
  },
  "didn't": {
    lemma: "did not (didn't)",
    posVi: 'Trợ động từ quá khứ',
    meaningVi: 'đã không (viết tắt của did not)',
    ipa: '/ˈdɪd.ənt/',
    pronTipVi: 'Nhấn âm 1: ĐÍT-đừn',
  },
  "can't": {
    lemma: "cannot (can't)",
    posVi: 'Động từ khuyết thiếu',
    meaningVi: 'không thể (viết tắt của cannot)',
    ipa: '/kɑːnt/',
    pronTipVi: 'Âm a kéo dài, bật t: KAAN-t',
  },
  "won't": {
    lemma: "will not (won't)",
    posVi: 'Động từ khuyết thiếu',
    meaningVi: 'sẽ không (viết tắt của will not)',
    ipa: '/wəʊnt/',
    pronTipVi: 'Đọc nối âm: UÔUN-t',
  },
  "it's": {
    lemma: "it is (it's)",
    posVi: 'Cụm đại từ + động từ',
    meaningVi: 'nó là / trời đang (viết tắt của it is / it has)',
    ipa: '/ɪts/',
    pronTipVi: 'Âm i ngắn, xì ts: ÍT-s',
  },
  "i'm": {
    lemma: "I am (I'm)",
    posVi: 'Cụm đại từ + động từ',
    meaningVi: 'tôi là / tôi đang (viết tắt của I am)',
    ipa: '/aɪm/',
    pronTipVi: 'Âm ai mím môi: AIM',
  },
  "she's": {
    lemma: "she is (she's)",
    posVi: 'Cụm đại từ + động từ',
    meaningVi: 'cô ấy là / cô ấy có (viết tắt của she is / she has)',
    ipa: '/ʃiːz/',
    pronTipVi: 'Âm sh chu môi, i dài và z: SHII-z',
  },
  "he's": {
    lemma: "he is (he's)",
    posVi: 'Cụm đại từ + động từ',
    meaningVi: 'anh ấy là / anh ấy có (viết tắt của he is / he has)',
    ipa: '/hiːz/',
    pronTipVi: 'Âm h, i dài và z: HII-z',
  },
  "they're": {
    lemma: "they are (they're)",
    posVi: 'Cụm đại từ + động từ',
    meaningVi: 'họ là / họ đang (viết tắt của they are)',
    ipa: '/ðeər/',
    pronTipVi: 'Đặt lưỡi giữa răng, đọc ĐE-ờ',
  },
  "we're": {
    lemma: "we are (we're)",
    posVi: 'Cụm đại từ + động từ',
    meaningVi: 'chúng tôi là / chúng ta đang (viết tắt của we are)',
    ipa: '/wɪər/',
    pronTipVi: 'Âm qui-ờ: UY-ờ',
  },
  "you're": {
    lemma: "you are (you're)",
    posVi: 'Cụm đại từ + động từ',
    meaningVi: 'bạn là / bạn đang (viết tắt của you are)',
    ipa: '/jɔːr/',
    pronTipVi: 'Đọc uốn lưỡi: IO-ờ',
  },
  "that's": {
    lemma: "that is (that's)",
    posVi: 'Cụm đại từ + động từ',
    meaningVi: 'đó là / điều đó thì (viết tắt của that is)',
    ipa: '/ðæts/',
    pronTipVi: 'Đặt lưỡi giữa răng, xì ts: ĐÁT-s',
  },
  "there's": {
    lemma: "there is (there's)",
    posVi: 'Cụm trạng từ + động từ',
    meaningVi: 'có / hiện diện (viết tắt của there is / there has)',
    ipa: '/ðeəz/',
    pronTipVi: 'Đặt lưỡi giữa răng, âm z: ĐE-ờz',
  },
  "isn't": {
    lemma: "is not (isn't)",
    posVi: 'Động từ to be phủ định',
    meaningVi: 'không phải, không là (viết tắt của is not)',
    ipa: '/ˈɪz.ənt/',
    pronTipVi: 'Nhấn âm 1: ÍZ-ừnt',
  },
  "aren't": {
    lemma: "are not (aren't)",
    posVi: 'Động từ to be phủ định',
    meaningVi: 'không phải, không là (viết tắt của are not)',
    ipa: '/ɑːnt/',
    pronTipVi: 'Âm a dài, bật t: AAN-t',
  },
  "wasn't": {
    lemma: "was not (wasn't)",
    posVi: 'Động từ to be quá khứ',
    meaningVi: 'đã không phải (viết tắt của was not)',
    ipa: '/ˈwɒz.ənt/',
    pronTipVi: 'Nhấn âm 1: QUÁZ-ừnt',
  },
  "weren't": {
    lemma: "were not (weren't)",
    posVi: 'Động từ to be quá khứ',
    meaningVi: 'đã không phải (viết tắt của were not)',
    ipa: '/wɜːnt/',
    pronTipVi: 'Âm ơ kéo dài, bật t: QUƠN-t',
  },
  "let's": {
    lemma: "let us (let's)",
    posVi: 'Cụm từ gợi ý',
    meaningVi: 'chúng ta hãy (viết tắt của let us)',
    ipa: '/lets/',
    pronTipVi: 'Âm e ngắn, xì ts: LET-s',
  },
};

export const PHRASAL_VERBS_MAP: Readonly<Record<string, BeginnerWordEntry>> = {
  'wake up': {
    lemma: 'wake up',
    posVi: 'Cụm động từ',
    meaningVi: 'thức dậy, tỉnh giấc',
    ipa: '/weɪk ʌp/',
    pronTipVi: 'Nối âm cuối k sang up: UẾCH-kắp',
  },
  'get up': {
    lemma: 'get up',
    posVi: 'Cụm động từ',
    meaningVi: 'rời khỏi giường, đứng dậy',
    ipa: '/ɡet ʌp/',
    pronTipVi: 'Nối âm t sang up: GÉT-tắp',
  },
  'look forward to': {
    lemma: 'look forward to',
    posVi: 'Cụm động từ',
    meaningVi: 'mong đợi, háo hức chờ đón',
    ipa: '/lʊk ˈfɔː.wəd tuː/',
  },
  'take off': {
    lemma: 'take off',
    posVi: 'Cụm động từ',
    meaningVi: 'cởi (áo/mũ), cất cánh',
    ipa: '/teɪk ɒf/',
  },
  'give up': {
    lemma: 'give up',
    posVi: 'Cụm động từ',
    meaningVi: 'từ bỏ, bỏ cuộc',
    ipa: '/ɡɪv ʌp/',
  },
  'put on': {
    lemma: 'put on',
    posVi: 'Cụm động từ',
    meaningVi: 'mặc vào, đội vào',
    ipa: '/pʊt ɒn/',
  },
  'turn on': {
    lemma: 'turn on',
    posVi: 'Cụm động từ',
    meaningVi: 'bật (đèn, thiết bị)',
    ipa: '/tɜːn ɒn/',
  },
  'come in': {
    lemma: 'come in',
    posVi: 'Cụm động từ',
    meaningVi: 'bước vào, đi vào',
    ipa: '/kʌm ɪn/',
  },
  'sit down': {
    lemma: 'sit down',
    posVi: 'Cụm động từ',
    meaningVi: 'ngồi xuống',
    ipa: '/sɪt daʊn/',
  },
  'find out': {
    lemma: 'find out',
    posVi: 'Cụm động từ',
    meaningVi: 'tìm ra, khám phá ra',
    ipa: '/faɪnd aʊt/',
  },
  'a lot of': {
    lemma: 'a lot of',
    posVi: 'Cụm lượng từ',
    meaningVi: 'nhiều, rất nhiều',
    ipa: '/ə lɒt əv/',
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
 * Normalizes punctuation and lowercases, with fallback stem matching for plurals, conjugations,
 * irregular verb forms, and contractions.
 */
export function lookupBeginnerWord(rawWord: string): BeginnerWordEntry | null {
  if (!rawWord) {
    return null;
  }
  const phraseClean = rawWord.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z' ]/g, '');
  if (PHRASAL_VERBS_MAP[phraseClean]) {
    return PHRASAL_VERBS_MAP[phraseClean];
  }
  const clean = rawWord
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z']/g, '')
    .replace(/^'+|'+$/g, '');
  if (!clean) {
    return null;
  }

  // 1. Common English contractions (don't, doesn't, it's, i'm, etc.)
  const contraction = CONTRACTION_MAP[clean];
  if (contraction) {
    return contraction;
  }

  // 2. Common irregular verbs (went -> go, drank -> drink, saw -> see, etc.)
  const irregular = IRREGULAR_VERB_MAP[clean];
  if (irregular) {
    const baseEntry = BEGINNER_LEXICON[irregular.base];
    if (baseEntry) {
      return {
        ...baseEntry,
        meaningVi: `${baseEntry.meaningVi} (${irregular.noteVi})`,
      };
    }
  }

  // 3. Direct lookup in curated lexicon
  const direct = BEGINNER_LEXICON[clean];
  if (direct) {
    return direct;
  }

  // Trailing 's
  if (clean.endsWith("'s") && clean.length > 2) {
    const stem = clean.slice(0, -2);
    if (BEGINNER_LEXICON[stem]) {
      return BEGINNER_LEXICON[stem];
    }
  }

  // Trailing -ing
  if (clean.endsWith('ing') && clean.length > 4) {
    const stem1 = clean.slice(0, -3);
    if (BEGINNER_LEXICON[stem1]) {
      return BEGINNER_LEXICON[stem1];
    }
    const stem2 = `${stem1}e`;
    if (BEGINNER_LEXICON[stem2]) {
      return BEGINNER_LEXICON[stem2];
    }
  }

  // Trailing -ed
  if (clean.endsWith('ed') && clean.length > 3) {
    const stem1 = clean.slice(0, -2);
    if (BEGINNER_LEXICON[stem1]) {
      return BEGINNER_LEXICON[stem1];
    }
    const stem2 = clean.slice(0, -1);
    if (BEGINNER_LEXICON[stem2]) {
      return BEGINNER_LEXICON[stem2];
    }
  }

  // Trailing -ies
  if (clean.endsWith('ies') && clean.length > 3) {
    const stem = `${clean.slice(0, -3)}y`;
    if (BEGINNER_LEXICON[stem]) {
      return BEGINNER_LEXICON[stem];
    }
  }

  // Trailing -es
  if (clean.endsWith('es') && clean.length > 3) {
    const stem1 = clean.slice(0, -2);
    if (BEGINNER_LEXICON[stem1]) {
      return BEGINNER_LEXICON[stem1];
    }
    const stem2 = clean.slice(0, -1);
    if (BEGINNER_LEXICON[stem2]) {
      return BEGINNER_LEXICON[stem2];
    }
  }

  // Trailing -s (excluding double s like pass, glass)
  if (clean.endsWith('s') && !clean.endsWith('ss') && clean.length > 2) {
    const stem = clean.slice(0, -1);
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

const LEARNER_TRAP_WARNINGS: Readonly<Record<string, string>> = {
  tea: 'Lưu ý: "tea" đồng âm với chữ cái "T" (/tiː/), không đọc là "tia".',
  schedule: 'Bẫy phát âm: Anh-Mỹ đọc là /ˈskedʒ.uːl/ (âm đầu sk-), không đọc là "sche-đun".',
  appointment: 'Lưu ý: Chứa âm đôi /ɔɪ/ ở âm tiết 2 (ờ-POIN-mần) và bật nhẹ âm cuối -nt.',
  talk: 'Bẫy âm câm: Chữ "l" trong "talk" (/tɔːk/) là âm câm, không cong lưỡi đọc chữ l.',
  walk: 'Bẫy âm câm: Chữ "l" trong "walk" (/wɔːk/) là âm câm.',
  know: 'Bẫy âm câm: Chữ "k" đầu từ "know" (/nəʊ/) là âm câm, đọc giống "no".',
  write: 'Bẫy âm câm: Chữ "w" đầu từ "write" (/raɪt/) là âm câm, đọc từ âm r-.',
  house: 'Lưu ý: Danh từ "house" kết thúc bằng âm /s/, đừng quên xì nhẹ cuối từ.',
  visit: 'Lưu ý: Trọng âm rơi vào âm tiết 1 (/ˈvɪz.ɪt/), tránh nhấn nhầm sang âm 2.',
};

export function getLearnerTrapWarning(term: string): string | null {
  const clean = term.trim().toLowerCase().replace(/[^a-z']/g, '');
  if (!clean) return null;
  if (LEARNER_TRAP_WARNINGS[clean]) return LEARNER_TRAP_WARNINGS[clean];
  const entry = lookupBeginnerWord(clean);
  if (entry && (LEARNER_TRAP_WARNINGS[entry.lemma] || LEARNER_TRAP_WARNINGS[entry.lemma.toLowerCase()])) {
    return LEARNER_TRAP_WARNINGS[entry.lemma] || LEARNER_TRAP_WARNINGS[entry.lemma.toLowerCase()];
  }
  return 'Mẹo nhớ sâu: Đọc to từ này 2 lần gắn với ngữ cảnh câu để tránh dịch từng chữ rời rạc.';
}

export const FALSE_FRIENDS_TRAPS: Readonly<Record<string, string>> = {
  actually: 'Cảnh báo từ dễ nhầm (False Friend): "actually" có nghĩa là "thực ra / thực sự", KHÔNG PHẢI "hiện tại" (hiện tại là "currently / presently").',
  eventually: 'Cảnh báo từ dễ nhầm (False Friend): "eventually" có nghĩa là "cuối cùng thì / rốt cuộc", KHÔNG PHẢI "thỉnh thoảng" (thỉnh thoảng là "occasionally").',
  sympathy: 'Cảnh báo từ dễ nhầm (False Friend): "sympathy" có nghĩa là "sự đồng cảm / thương hại", KHÔNG PHẢI "thông cảm" thông thường.',
  chef: 'Cảnh báo phát âm & nghĩa: "chef" là đầu bếp trưởng (/ʃef/), KHÔNG PHẢI sếp/thủ lĩnh (sếp là "chief" /tʃiːf/).',
  sensible: 'Cảnh báo từ dễ nhầm (False Friend): "sensible" có nghĩa là "biết điều / hợp lý", KHÔNG PHẢI "nhạy cảm" (nhạy cảm là "sensitive").',
  confident: 'Cảnh báo từ dễ nhầm (False Friend): "confident" có nghĩa là "tự tin", KHÔNG PHẢI "người tâm sự" (người tâm sự là "confidant").',
  tea: 'Cảnh báo từ dễ nhầm: "tea" đồng âm với chữ cái "T" (/tiː/), không đọc là "tia".',
  appointment: 'Cảnh báo bẫy ngữ âm: "appointment" nhấn trọng âm 2 (/əˈpɔɪnt.mənt/), không nhấn âm đầu.',
};

export function getFalseFriendTrap(term: string): string | null {
  if (!term) return null;
  const clean = term.trim().toLowerCase().replace(/[^a-z']/g, '');
  if (!clean) return null;
  if (FALSE_FRIENDS_TRAPS[clean]) return FALSE_FRIENDS_TRAPS[clean];
  const entry = lookupBeginnerWord(clean);
  if (entry) {
    const lemmaClean = entry.lemma.toLowerCase().replace(/[^a-z']/g, '');
    if (FALSE_FRIENDS_TRAPS[lemmaClean]) return FALSE_FRIENDS_TRAPS[lemmaClean];
  }
  return null;
}

export interface IrregularVerbConjugation {
  readonly base: string;
  readonly past: string;
  readonly participle: string;
  readonly vi: string;
}

export const IRREGULAR_VERBS_MAP: Readonly<Record<string, IrregularVerbConjugation>> = {
  go: { base: 'go', past: 'went', participle: 'gone', vi: 'đi' },
  went: { base: 'go', past: 'went', participle: 'gone', vi: 'đã đi (quá khứ của go)' },
  gone: { base: 'go', past: 'went', participle: 'gone', vi: 'đã đi (phân từ của go)' },
  drink: { base: 'drink', past: 'drank', participle: 'drunk', vi: 'uống' },
  drank: { base: 'drink', past: 'drank', participle: 'drunk', vi: 'đã uống (quá khứ của drink)' },
  drunk: { base: 'drink', past: 'drank', participle: 'drunk', vi: 'đã uống (phân từ của drink)' },
  buy: { base: 'buy', past: 'bought', participle: 'bought', vi: 'mua' },
  bought: { base: 'buy', past: 'bought', participle: 'bought', vi: 'đã mua (quá khứ/phân từ của buy)' },
  think: { base: 'think', past: 'thought', participle: 'thought', vi: 'nghĩ, suy nghĩ' },
  thought: { base: 'think', past: 'thought', participle: 'thought', vi: 'đã nghĩ (quá khứ/phân từ của think)' },
  see: { base: 'see', past: 'saw', participle: 'seen', vi: 'nhìn thấy' },
  saw: { base: 'see', past: 'saw', participle: 'seen', vi: 'đã thấy (quá khứ của see)' },
  seen: { base: 'see', past: 'saw', participle: 'seen', vi: 'đã thấy (phân từ của see)' },
  eat: { base: 'eat', past: 'ate', participle: 'eaten', vi: 'ăn' },
  ate: { base: 'eat', past: 'ate', participle: 'eaten', vi: 'đã ăn (quá khứ của eat)' },
  eaten: { base: 'eat', past: 'ate', participle: 'eaten', vi: 'đã ăn (phân từ của eat)' },
  take: { base: 'take', past: 'took', participle: 'taken', vi: 'cầm, lấy' },
  took: { base: 'take', past: 'took', participle: 'taken', vi: 'đã lấy (quá khứ của take)' },
  taken: { base: 'take', past: 'took', participle: 'taken', vi: 'đã lấy (phân từ của take)' },
  write: { base: 'write', past: 'wrote', participle: 'written', vi: 'viết' },
  wrote: { base: 'write', past: 'wrote', participle: 'written', vi: 'đã viết (quá khứ của write)' },
  written: { base: 'write', past: 'wrote', participle: 'written', vi: 'đã viết (phân từ của write)' },
};

export function getIrregularVerbInfo(term: string): IrregularVerbConjugation | null {
  if (!term) return null;
  const clean = term.trim().toLowerCase().replace(/[^a-z']/g, '');
  if (!clean) return null;
  return IRREGULAR_VERBS_MAP[clean] ?? null;
}

export const WORD_FAMILY_HINTS: Readonly<Record<string, string>> = {
  tea: 'Họ từ & từ ghép: teapot (ấm trà), teacup (tách trà), teahouse (quán trà).',
  schedule: 'Họ từ (Word family): scheduled (adj - theo lịch), unscheduled (adj - đột xuất), scheduler (n).',
  appointment: 'Họ từ (Word family): appoint (v - bổ nhiệm/hẹn), appointed (adj - đã định).',
  morning: 'Từ ghép thông dụng: morning routine (thói quen buổi sáng), early morning (sáng sớm).',
  visit: 'Họ từ (Word family): visitor (n - khách thăm), visiting (n/adj - chuyến thăm).',
  work: 'Họ từ (Word family): worker (n - người lao động), workplace (n - nơi làm việc), working (adj).',
  help: 'Họ từ (Word family): helpful (adj - hữu ích), helpless (adj - bất lực), helper (n).',
  learn: 'Họ từ (Word family): learner (n - người học), learning (n - việc học), learned (adj).',
};

export function getWordFamilyHint(term: string): string | null {
  const clean = term.trim().toLowerCase().replace(/[^a-z']/g, '');
  if (!clean) return null;
  if (WORD_FAMILY_HINTS[clean]) return WORD_FAMILY_HINTS[clean];
  const entry = lookupBeginnerWord(clean);
  if (entry && (WORD_FAMILY_HINTS[entry.lemma] || WORD_FAMILY_HINTS[entry.lemma.toLowerCase()])) {
    return WORD_FAMILY_HINTS[entry.lemma] || WORD_FAMILY_HINTS[entry.lemma.toLowerCase()];
  }
  return `Họ từ & biến thể: Chú ý các hậu tố thường gặp (-er, -ing, -ed, -ly) khi gặp "${clean}" trong bài đọc.`;
}


