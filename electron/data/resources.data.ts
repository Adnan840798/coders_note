import type { Resource } from '../../shared/types'

export const CURATED_RESOURCES: Omit<Resource, 'isBookmarked'>[] = [
  {
    id: 1,
    title: 'USACO Guide',
    url: 'https://usaco.guide/',
    topic: 'General CP',
    difficulty: 'beginner',
    type: 'course',
    description: 'A free, curated competitive programming curriculum designed by USACO finalists covering all standard contest divisions.'
  },
  {
    id: 2,
    title: 'CP-Algorithms (E-Maxx)',
    url: 'https://cp-algorithms.com/',
    topic: 'Algorithms & Data Structures',
    difficulty: 'intermediate',
    type: 'article',
    description: 'Comprehensive tutorials and implementations of classical algorithms used in competitive programming.'
  },
  {
    id: 3,
    title: 'CSES Problem Set',
    url: 'https://cses.fi/problemset/',
    topic: 'Problem Practice',
    difficulty: 'intermediate',
    type: 'problem-set',
    description: 'A collection of 300 foundational algorithmic problems across sorting, graphs, DP, range queries, and trees.'
  },
  {
    id: 4,
    title: 'AtCoder Educational DP Contest',
    url: 'https://atcoder.jp/contests/dp',
    topic: 'Dynamic Programming',
    difficulty: 'intermediate',
    type: 'problem-set',
    description: '26 fundamental dynamic programming problems ranging from basic knapsack and digit DP to matrix exponentiation.'
  },
  {
    id: 5,
    title: 'Codeforces EDU Academy',
    url: 'https://codeforces.com/edu/courses',
    topic: 'Data Structures',
    difficulty: 'beginner',
    type: 'course',
    description: 'Official interactive Codeforces courses on Segment Trees, Disjoint Set Union, Suffix Arrays, and Two Pointers.'
  },
  {
    id: 6,
    title: 'Errichto Algorithms & CP',
    url: 'https://www.youtube.com/@Errichto',
    topic: 'Tutorials & Walkthroughs',
    difficulty: 'intermediate',
    type: 'video',
    description: 'Intuitive video explanations and problem walkthroughs by an International Grandmaster and ICPC Finalist.'
  },
  {
    id: 7,
    title: 'Competitive Programmer\'s Handbook',
    url: 'https://cses.fi/book/book.pdf',
    topic: 'Handbook',
    difficulty: 'beginner',
    type: 'book',
    description: 'An approachable textbook by Antti Laaksonen covering algorithmic problem solving for programming contests.'
  },
  {
    id: 8,
    title: 'KACTL — KTH Algorithm Template Library',
    url: 'https://github.com/kth-competitive-programming/kactl',
    topic: 'Code Templates',
    difficulty: 'advanced',
    type: 'article',
    description: 'Ultra-concise, battle-tested C++ competitive programming template library used in ICPC World Finals.'
  }
]
