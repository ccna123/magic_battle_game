export const $ = s => document.querySelector(s);
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const EVOLVE_AT = 2, MAXF = 3, MAXS = 5, MAXMANA = 10, START_LP = 20, HAND_MAX = 8;
export const KIND = {creature:'Linh thú', charm:'Bùa chú', enchant:'Phép duy trì', counter:'Phản chú'};
export const EL = {fire:{n:'Lửa',c:'#e8673a'}, water:{n:'Nước',c:'#4a96e6'}, storm:{n:'Sét',c:'#e3c44a'}, ice:{n:'Băng',c:'#93dbf2'}, none:{n:'Trung lập',c:'#a59f94'}};
export const STN = {wet:'Ướt', burn:'Cháy', frozen:'Đóng băng', stun:'Choáng'};
