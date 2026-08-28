const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits, 
    ChannelType, 
    SlashCommandBuilder, 
    REST, 
    Routes,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActivityType,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.MessageContent
    ]
});

// Map لتتبع عدد مرات كتابة need في كل قناة
const needTracker = new Map();

// ==================== CONFIGURATION ====================
const CONFIG = {
    TOKEN: process.env.TOKEN, 
    
    CLIENT_ID: "1540099644028096572", 
    GUILD_ID: "1538685893622108251",  
    
    FREE_SPIN_ADMIN_ROLE_ID: "1538910850272722997", 
    BUY_ORDER_TAG_ROLE_ID: "1538901876043554817",

    // 👈 الكاتيجوري الخاصة بالأرشيف للـ Tickets المسدودة (حط الـ ID ديالها هنا)
    CLOSED_CATEGORY_ID: "1543026472799965314",

    // الـ Category المخصصة ميزة الـ Claim برمز *
    CLAIM_CATEGORY_ID: "1540504775760678952", 

    SERVER_BANNER: "https://cdn.discordapp.com/attachments/1315665568228966410/1540122036725350441/octopus_png_banner.png", 
    ORDER_BANNER: "https://cdn.discordapp.com/attachments/1315665568228966410/1540122036725350441/octopus_png_banner.png", 

    LINE_BANNER: "https://cdn.discordapp.com/attachments/1541542336247631893/1541545506835275837/banner_gif_octopus_studio.gif?ex=6a8dfba1&is=6a8caa21&hm=2331f9c4df94b4c7ae656c9026529d87e048ebbf2b26743efe0e4f33693b7525&",
    SERVER_LOGO: "https://cdn.discordapp.com/attachments/1538901931773141082/1541502242253705326/kling_20260825_VIDEO_hello_need_276_0-ezgif.com-video-to-gif-converter.gif?ex=6a8dd356&is=6a8c81d6&hm=8caad6ed557d185634f404736aaa44b1649d13cdf432b694c17b37eec10f95b2&",

    SETUP_CHANNEL_ID: "1538901953331986594", 
    INVITES_REQUIRED: 6, 

    STREAMING: {
        NAME: "Discord.gg/Octopus-s",
        URL: "https://www.twitch.tv/discord" 
    },

    EMOJIS: {
        PUB: "<:kndpub:1540126362658938940>",
        BUGS: "<a:emoji:1540126667815526451>",
        DONATE: "<:mny:1540091412719210637>",
        REMPLACEMENT: "<a:work1:1540127049132286022>",
        SPIN: "<a:extra_7:1540127733231648808>",
        BUY_ORDER: "<:SHOP:1539754401340858498>",
        DELETE: "<:delete:1540129242107346984>",
        CLAIM: "<:claim:1540129878916210738>",
        RENAME: "<:emoji_164:1539801927955648552>",

        BOT_READY: "🤖",
        SUCCESS: "✅",
        ERROR: "❌",
        LOCK: "🔒",
        SWORD: "⚔️",
        FLOWER_SPARK: "🌸⚡",
        TIMER: "⏱️",
        FREE_SPIN_TICKET: "🎟️",
        STATS: "📊",
        CONGRATS: "🎉",
        INBOX: "📥",
        WARNING: "⚠️",
        PENCIL: "✏️",
        SLOT_MACHINE: "🎰"
    },

    TICKETS: {
        pub: { name: "Pub", label: "Pub", description: "Report spam or pub", categoryId: "1540123963043086417", roleId: "1540124358771605565", emoji: "<:kndpub:1540126362658938940>" },
        bugs: { name: "Bugs", label: "Bugs", description: "Report bugs or issues", categoryId: "1540123940700299374", roleId: "1540124504406098071", emoji: "<a:emoji:1540126667815526451>" },
        remplacement: { name: "Remplacement", label: "Remplacement", description: "Report issues or replacement", categoryId: "1540123905480462456", roleId: "1540124434772533308", emoji: "<a:work1:1540127049132286022>" },
        donate: { name: "Donate", label: "Donate", description: "Support The Server", categoryId: "1540123985860239472", roleId: "1540124475503280229", emoji: "<:mny:1540091412719210637>" },
        spin: { name: "Spin Wheel", label: "Spin Wheel", description: "Open Spin Ticket", categoryId: "1540124005137121370", roleId: "1540124575042637955", emoji: "<a:extra_7:1540127733231648808>" },
        buy_order: { name: "Buy Order", label: "Buy Order", description: "Create a buy order", categoryId: "1540504775760678952", roleId: "1540509073332641865", emoji: "<:SHOP:1539754401340858498>" }
    }
};

const invitesCache = new Map();
const projectsDir = path.join(__dirname, 'projects');
const spinsFilePath = path.join(__dirname, 'free_spins.json');

if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir);

function getFreeSpinsData() {
    if (!fs.existsSync(spinsFilePath)) fs.writeFileSync(spinsFilePath, JSON.stringify({}));
    return JSON.parse(fs.readFileSync(spinsFilePath, 'utf8'));
}

function saveFreeSpinsData(data) {
    fs.writeFileSync(spinsFilePath, JSON.stringify(data, null, 2));
}

function getTicketTypeByChannel(channel) {
    if (!channel || !channel.parentId) return null;
    return Object.values(CONFIG.TICKETS).find(t => t.categoryId === channel.parentId);
}

// دالة مخصصة لإغلاق الـ Ticket ونقلها للأرشيف
async function closeTicket(channel, user) {
    needTracker.delete(channel.id);

    const closedCategory = channel.guild.channels.cache.get(CONFIG.CLOSED_CATEGORY_ID);
    
    // إذا مالقاش الكاتيجوري ديال الإغلاق كيديليتي القناة
    if (!closedCategory) {
        return channel.delete().catch(() => {});
    }

    try {
        // تغيير اسم القناة وحركتها للـ Category الجديدة
        await channel.setName(`closed-${channel.name.replace(/^by-/, '')}`);
        await channel.setParent(closedCategory.id, { lockPermissions: false });

        // سحب صلاحية الكتابة والروية من العضو صاحب التذكرة (إلا إلا كان الأدمن)
        await channel.permissionOverwrites.set([
            { id: channel.guild.id, deny: [PermissionFlagsBits.ViewChannel] }
        ]);

        const closedEmbed = new EmbedBuilder()
            .setColor("#ff0000")
            .setTitle("🔒 Ticket Closed")
            .setDescription(`This ticket was closed by <@${user.id}> and moved to archive.`)
            .setTimestamp();

        await channel.send({ embeds: [closedEmbed] });
    } catch (err) {
        console.error("Error closing ticket:", err);
    }
}

function cleanExpiredSpins() {
    const spinsData = getFreeSpinsData();
    const now = Date.now();
    let updated = false;

    for (const userId in spinsData) {
        if (spinsData[userId].expiresAt && spinsData[userId].expiresAt < now) {
            delete spinsData[userId];
            updated = true;
        }
    }
    if (updated) saveFreeSpinsData(spinsData);
}

setInterval(cleanExpiredSpins, 60000);

// ==================== READY EVENT & SLASH COMMANDS ====================

client.once('ready', async () => {
    console.log(`${CONFIG.EMOJIS.BOT_READY} Bot Ready! Logged in as ${client.user.tag}`);
    cleanExpiredSpins();
    
    client.user.setActivity(CONFIG.STREAMING.NAME, {
        type: ActivityType.Streaming,
        url: CONFIG.STREAMING.URL
    });

    for (const [guildId, guild] of client.guilds.cache) {
        try {
            const firstInvites = await guild.invites.fetch();
            invitesCache.set(guild.id, new Map(firstInvites.map(inv => [inv.code, inv.uses])));
        } catch (err) {
            console.log(`Could not fetch invites for ${guild.name}`);
        }
    }

    const commands = [
        new SlashCommandBuilder().setName('setup-ticket').setDescription('Setup the ticket panel').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        new SlashCommandBuilder().setName('spin').setDescription('Spin to get a random project'),
        new SlashCommandBuilder().setName('givefreespin').setDescription('Give free spins to a specific user')
            .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
            .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true))
            .addNumberOption(o => o.setName('hours').setDescription('Hours').setRequired(true))
    ];

    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID), { body: commands });
        console.log(`${CONFIG.EMOJIS.SUCCESS} Commands registered!`);
    } catch (error) {
        console.error("Error registering slash commands:", error);
    }
});

// ==================== MESSAGE HANDLER ====================

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const msgContent = message.content.toLowerCase().trim();

    // 1. أمر الخط: line أو !line
    if (msgContent === 'line' || msgContent === '!line') {
        await message.delete().catch(() => {});
        const lineEmbed = new EmbedBuilder()
            .setColor("#2b2d31")
            .setImage(CONFIG.LINE_BANNER);
            
        return message.channel.send({ embeds: [lineEmbed] });
    }

    // 2. أمر البنر الرئيسي: banner أو !banner
    if (msgContent === 'banner' || msgContent === '!banner') {
        await message.delete().catch(() => {});
        const bannerEmbed = new EmbedBuilder()
            .setColor("#2b2d31")
            .setImage(CONFIG.ORDER_BANNER);
            
        return message.channel.send({ embeds: [bannerEmbed] });
    }

    // 3. أمر اللوغو: logo أو !logo
    if (msgContent === 'logo' || msgContent === '!logo') {
        await message.delete().catch(() => {});
        const logoEmbed = new EmbedBuilder()
            .setColor("#2b2d31")
            .setImage(CONFIG.SERVER_LOGO);
            
        return message.channel.send({ embeds: [logoEmbed] });
    }

    // نظام الـ Need Counter
    if (message.channel.parentId === CONFIG.TICKETS.buy_order.categoryId) {
        if (msgContent.startsWith('need')) {
            const currentCount = needTracker.get(message.channel.id) || 0;

            if (currentCount >= 2) {
                return message.reply(`${CONFIG.EMOJIS.WARNING} Do not spam need .... or u will get warn`);
            }

            needTracker.set(message.channel.id, currentCount + 1);

            const formattedName = message.content.toLowerCase().replace(/[^a-z0-9- ]/g, '').trim().replace(/\s+/g, '-');
            try {
                await message.channel.setName(formattedName);
                await message.react('✅').catch(() => {});
            } catch (err) {
                await message.react('⚠️').catch(() => {});
                await message.reply(`${CONFIG.EMOJIS.WARNING} ما أمكنش يتغير اسم الروم دابا بسبب حماية Discord (Rate Limit)، حاول شوية آخر.`).catch(() => {});
            }
        }
    }

    // نظام Claim بـ "*" فالـ Category المحددة
    if (message.content.trim() === '*' && message.channel.parentId === CONFIG.CLAIM_CATEGORY_ID) {
        const ticketConfig = getTicketTypeByChannel(message.channel);
        if (ticketConfig) {
            const hasStaffRole = message.member.roles.cache.has(ticketConfig.roleId);
            if (!hasStaffRole && !message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        }

        const newName = `by-${message.author.username}`;
        try {
            await message.channel.setName(newName);
        } catch (e) {}

        const claimEmbed = new EmbedBuilder()
            .setColor("#ff0000")
            .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL() })
            .setTitle("Ticket Claimed")
            .setDescription(
                `**This Ticket Has Been Claimed By:** <@${message.author.id}>\n\n` +
                `**If You Enter Without Permission From <@${message.author.id}> You Will Be Warned**`
            )
            .setFooter({ text: `${message.guild.name} ✨` })
            .setTimestamp();

        return message.channel.send({ embeds: [claimEmbed] });
    }

    // الأوامر الخاصة بالـ Tickets فقط ($close, $claim, $rename)
    const ticketConfig = getTicketTypeByChannel(message.channel);
    if (!ticketConfig && message.channel.parentId !== CONFIG.CLOSED_CATEGORY_ID) return;

    const args = message.content.trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === '$close') {
        await message.reply(`${CONFIG.EMOJIS.LOCK} Closing ticket and moving to archive...`);
        setTimeout(() => closeTicket(message.channel, message.author), 3000);
    }

    if (command === '$claim') {
        const hasStaffRole = ticketConfig ? message.member.roles.cache.has(ticketConfig.roleId) : false;
        if (!hasStaffRole && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply(`${CONFIG.EMOJIS.ERROR} Only staff members can claim this ticket!`);
        }
        const newName = `by-${message.author.username}`;
        try {
            await message.channel.setName(newName);
            return message.reply(`${CONFIG.EMOJIS.SUCCESS} Ticket claimed by **<@${message.author.id}>**!`);
        } catch (e) {
            return message.reply(`${CONFIG.EMOJIS.SUCCESS} Ticket claimed by **<@${message.author.id}>**! (تعذر تغيير اسم القناة حالياً)`);
        }
    }

    if (command === '$rename') {
        const newName = args.join('-');
        if (!newName) return message.reply(`${CONFIG.EMOJIS.ERROR} Please provide a name!`);
        try {
            await message.channel.setName(newName);
            return message.reply(`${CONFIG.EMOJIS.PENCIL} Ticket renamed to: \`${newName}\``);
        } catch (e) {
            return message.reply(`${CONFIG.EMOJIS.ERROR} تعذر تغيير الاسم حالياً بسبب Rate Limit الخاص بـ Discord.`);
        }
    }
});

// ==================== INTERACTION HANDLING ====================

client.on('interactionCreate', async interaction => {
    
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup-ticket') {
            if (interaction.channelId !== CONFIG.SETUP_CHANNEL_ID) {
                return interaction.reply({ content: `${CONFIG.EMOJIS.ERROR} Use this command in <#${CONFIG.SETUP_CHANNEL_ID}>!`, ephemeral: true });
            }

            const ticketEmbed = new EmbedBuilder()
                .setColor("#2b2d31")
                .setAuthor({ name: `${interaction.guild.name} • Ticket Support System`, iconURL: client.user.displayAvatarURL() })
                .setDescription(
                    `• Welcome to our Support & Order Center!\n\n` +
                    `• ${CONFIG.EMOJIS.PUB} **${CONFIG.TICKETS.pub.label}** : ${CONFIG.TICKETS.pub.description} ${CONFIG.EMOJIS.SWORD}\n` +
                    `• ${CONFIG.EMOJIS.BUGS} **${CONFIG.TICKETS.bugs.label}** : ${CONFIG.TICKETS.bugs.description} ${CONFIG.EMOJIS.SWORD}\n` +
                    `• ${CONFIG.EMOJIS.REMPLACEMENT} **${CONFIG.TICKETS.remplacement.label}** : ${CONFIG.TICKETS.remplacement.description} ${CONFIG.EMOJIS.SWORD}\n` +
                    `• ${CONFIG.EMOJIS.DONATE} **${CONFIG.TICKETS.donate.label}** : ${CONFIG.TICKETS.donate.description} ${CONFIG.EMOJIS.SWORD}\n` +
                    `• ${CONFIG.EMOJIS.SPIN} **${CONFIG.TICKETS.spin.label}** : ${CONFIG.TICKETS.spin.description} ${CONFIG.EMOJIS.SWORD}\n` +
                    `• ${CONFIG.EMOJIS.BUY_ORDER} **${CONFIG.TICKETS.buy_order.label}** : ${CONFIG.TICKETS.buy_order.description} ${CONFIG.EMOJIS.SWORD}`
                )
                .setImage(CONFIG.SERVER_BANNER);

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_ticket')
                .setPlaceholder('Select Ticket')
                .addOptions(
                    Object.entries(CONFIG.TICKETS).map(([key, item]) => 
                        new StringSelectMenuOptionBuilder()
                            .setLabel(item.label)
                            .setValue(key)
                            .setDescription(item.description)
                            .setEmoji(item.emoji)
                    )
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.channel.send({ embeds: [ticketEmbed], components: [row] });
            return interaction.reply({ content: `${CONFIG.EMOJIS.SUCCESS} Ticket Panel with Dropdown sent successfully!`, ephemeral: true });
        }

        if (interaction.commandName === 'givefreespin') {
            const hasRole = interaction.member.roles.cache.has(CONFIG.FREE_SPIN_ADMIN_ROLE_ID);
            if (!hasRole && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: `${CONFIG.EMOJIS.ERROR} No permission!`, ephemeral: true });
            }

            const targetUser = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const hours = interaction.options.getNumber('hours');

            cleanExpiredSpins();
            const spinsData = getFreeSpinsData();
            const expiresAt = Date.now() + (hours * 60 * 60 * 1000);
            const currentAmount = spinsData[targetUser.id] ? spinsData[targetUser.id].amount : 0;

            spinsData[targetUser.id] = { amount: currentAmount + amount, expiresAt: expiresAt };
            saveFreeSpinsData(spinsData);

            return interaction.reply({ content: `${CONFIG.EMOJIS.SUCCESS} Granted **${amount}** Free Spin(s) to <@${targetUser.id}>!` });
        }
    }

    // Modal Submissions
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_rename_ticket') {
            await interaction.deferReply({ ephemeral: true });
            const newName = interaction.fields.getTextInputValue('input_ticket_name');
            const formattedName = newName.toLowerCase().replace(/[^a-z0-9- ]/g, '').trim().replace(/\s+/g, '-');
            
            try {
                await interaction.channel.setName(formattedName);
                return interaction.editReply({ content: `${CONFIG.EMOJIS.PENCIL} Ticket renamed to: \`${formattedName}\`` });
            } catch (err) {
                return interaction.editReply({ content: `${CONFIG.EMOJIS.ERROR} تعذر تغيير اسم القناة حالياً بسبب حماية Discord (Rate Limit).` });
            }
        }
    }

    // Dropdown Selection Handling
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'select_ticket') {
            const selectedKey = interaction.values[0];
            const selectedTicket = CONFIG.TICKETS[selectedKey];

            if (!selectedTicket) return;

            const category = interaction.guild.channels.cache.get(selectedTicket.categoryId);
            if (!category) return interaction.reply({ content: `${CONFIG.EMOJIS.ERROR} Category not found! Check CONFIG.`, ephemeral: true });

            const ticketChannel = await interaction.guild.channels.create({
                name: `${selectedTicket.name.toLowerCase()}-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                    { id: selectedTicket.roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }
                ]
            });

            const ticketControlRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setEmoji(CONFIG.EMOJIS.DELETE).setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setEmoji(CONFIG.EMOJIS.CLAIM).setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('ticket_rename').setLabel('Rename').setEmoji(CONFIG.EMOJIS.RENAME).setStyle(ButtonStyle.Secondary)
            );

            if (selectedKey === 'buy_order') {
                const buyEmbed = new EmbedBuilder()
                    .setColor("#d4af37")
                    .setThumbnail(interaction.guild.iconURL())
                    .setDescription(
                        `⚜️ **السلام عليكم ورحمة الله وبركاته**\n` +
                        `⚜️ **معك طاقم العمل لدى متجرنا في تذكرة الطلب**\n` +
                        `⚜️ **يرجى تحديد طلبك باستخدام الأمر التالي:**\n\n` +
                        `\`\`\`\nneed <product>\nneed <اسم المنتج>\n\`\`\``
                    )
                    .setImage(CONFIG.ORDER_BANNER);

                await ticketChannel.send({ 
                    content: `<@&${CONFIG.BUY_ORDER_TAG_ROLE_ID}>`, 
                    embeds: [buyEmbed], 
                    components: [ticketControlRow] 
                });
            } 
            else {
                const embedMsg = new EmbedBuilder()
                    .setColor("#2b2d31")
                    .setTitle(`Ticket: ${selectedTicket.name}`)
                    .setDescription(`Welcome <@${interaction.user.id}>! Staff will assist you shortly.`)
                    .setThumbnail(client.user.displayAvatarURL());

                await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embedMsg], components: [ticketControlRow] });
            }

            return interaction.reply({ content: `${CONFIG.EMOJIS.SUCCESS} Ticket opened: ${ticketChannel}`, ephemeral: true });
        }
    }

    // Buttons Inside Ticket Handling
    if (interaction.isButton()) {
        if (interaction.customId === 'ticket_rename') {
            const modal = new ModalBuilder()
                .setCustomId('modal_rename_ticket')
                .setTitle('Rename Ticket');

            const nameInput = new TextInputBuilder()
                .setCustomId('input_ticket_name')
                .setLabel('New Ticket Name')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
            return interaction.showModal(modal);
        }

        if (interaction.customId === 'ticket_close') {
            await interaction.reply({ content: `${CONFIG.EMOJIS.LOCK} Closing ticket and moving to archive in 3 seconds...` });
            setTimeout(() => {
                closeTicket(interaction.channel, interaction.user);
            }, 3000);
            return;
        }

        if (interaction.customId === 'ticket_claim') {
            await interaction.deferReply();
            const ticketConfig = getTicketTypeByChannel(interaction.channel);
            if (ticketConfig) {
                const hasStaffRole = interaction.member.roles.cache.has(ticketConfig.roleId);
                if (!hasStaffRole && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.editReply({ content: `${CONFIG.EMOJIS.ERROR} Only staff members can claim!` });
                }
            }
            const newName = `by-${interaction.user.username}`;
            
            try {
                await interaction.channel.setName(newName);
            } catch (err) {}

            return interaction.editReply({ content: `${CONFIG.EMOJIS.SUCCESS} Claimed by **<@${interaction.user.id}>**!` });
        }
    }
});

client.login(CONFIG.TOKEN);
