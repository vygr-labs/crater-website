// Hymns for the practice console. All are long out of copyright.
// Each song lists its sections once and the order they are sung in.

export type Song = {
	id: string;
	title: string;
	author: string;
	sections: Record<string, string>;
	order: string[];
};

export const sectionName = (k: string) => (k === "C" ? "Chorus" : `Verse ${k.slice(1)}`);

export const SONGS: Song[] = [
	{
		id: "amazing-grace",
		title: "Amazing Grace",
		author: "John Newton",
		sections: {
			V1: "Amazing grace! How sweet the sound\nThat saved a wretch like me!\nI once was lost, but now am found,\nWas blind, but now I see.",
			V2: "'Twas grace that taught my heart to fear,\nAnd grace my fears relieved;\nHow precious did that grace appear\nThe hour I first believed.",
			V3: "Through many dangers, toils and snares,\nI have already come;\n'Tis grace hath brought me safe thus far,\nAnd grace will lead me home.",
			V4: "When we've been there ten thousand years,\nBright shining as the sun,\nWe've no less days to sing God's praise\nThan when we'd first begun.",
		},
		order: ["V1", "V2", "V3", "V4"],
	},
	{
		id: "it-is-well",
		title: "It Is Well with My Soul",
		author: "Horatio Spafford",
		sections: {
			V1: "When peace like a river attendeth my way,\nWhen sorrows like sea billows roll;\nWhatever my lot, Thou hast taught me to say,\nIt is well, it is well with my soul.",
			C: "It is well (it is well)\nWith my soul (with my soul),\nIt is well, it is well with my soul.",
			V2: "Though Satan should buffet, though trials should come,\nLet this blest assurance control,\nThat Christ has regarded my helpless estate,\nAnd hath shed His own blood for my soul.",
			V3: "My sin, oh, the bliss of this glorious thought!\nMy sin, not in part but the whole,\nIs nailed to the cross, and I bear it no more,\nPraise the Lord, praise the Lord, O my soul!",
			V4: "And Lord, haste the day when my faith shall be sight,\nThe clouds be rolled back as a scroll;\nThe trump shall resound, and the Lord shall descend,\nEven so, it is well with my soul.",
		},
		order: ["V1", "C", "V2", "C", "V3", "C", "V4", "C"],
	},
	{
		id: "blessed-assurance",
		title: "Blessed Assurance",
		author: "Fanny Crosby",
		sections: {
			V1: "Blessed assurance, Jesus is mine!\nO what a foretaste of glory divine!\nHeir of salvation, purchase of God,\nBorn of His Spirit, washed in His blood.",
			C: "This is my story, this is my song,\nPraising my Saviour all the day long;\nThis is my story, this is my song,\nPraising my Saviour all the day long.",
			V2: "Perfect submission, perfect delight,\nVisions of rapture now burst on my sight;\nAngels descending bring from above\nEchoes of mercy, whispers of love.",
			V3: "Perfect submission, all is at rest,\nI in my Saviour am happy and blest,\nWatching and waiting, looking above,\nFilled with His goodness, lost in His love.",
		},
		order: ["V1", "C", "V2", "C", "V3", "C"],
	},
	{
		id: "holy-holy-holy",
		title: "Holy, Holy, Holy",
		author: "Reginald Heber",
		sections: {
			V1: "Holy, holy, holy! Lord God Almighty!\nEarly in the morning our song shall rise to Thee;\nHoly, holy, holy, merciful and mighty!\nGod in three Persons, blessed Trinity!",
			V2: "Holy, holy, holy! All the saints adore Thee,\nCasting down their golden crowns around the glassy sea;\nCherubim and seraphim falling down before Thee,\nWho wert, and art, and evermore shalt be.",
			V3: "Holy, holy, holy! though the darkness hide Thee,\nThough the eye of sinful man Thy glory may not see;\nOnly Thou art holy; there is none beside Thee,\nPerfect in power, in love, and purity.",
			V4: "Holy, holy, holy! Lord God Almighty!\nAll Thy works shall praise Thy name, in earth, and sky, and sea;\nHoly, holy, holy; merciful and mighty!\nGod in three Persons, blessed Trinity!",
		},
		order: ["V1", "V2", "V3", "V4"],
	},
	{
		id: "what-a-friend",
		title: "What a Friend We Have in Jesus",
		author: "Joseph Scriven",
		sections: {
			V1: "What a friend we have in Jesus,\nAll our sins and griefs to bear!\nWhat a privilege to carry\nEverything to God in prayer!",
			V2: "O what peace we often forfeit,\nO what needless pain we bear,\nAll because we do not carry\nEverything to God in prayer!",
			V3: "Have we trials and temptations?\nIs there trouble anywhere?\nWe should never be discouraged;\nTake it to the Lord in prayer.",
			V4: "Can we find a friend so faithful\nWho will all our sorrows share?\nJesus knows our every weakness;\nTake it to the Lord in prayer.",
		},
		order: ["V1", "V2", "V3", "V4"],
	},
];
