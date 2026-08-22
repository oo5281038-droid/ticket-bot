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

// ==================== CONFIGURATION ====================
const CONFIG = {
    TOKEN: process.env.TOKEN, 
    
    CLIENT_ID: "1540099644028096572", 
    GUILD_ID: "1538685893622108251",  
    
    FREE_SPIN_ADMIN_ROLE_ID: "1538910850272722997", 
    BUY_ORDER_TAG_ROLE_ID: "1538901876043554817",

    SERVER_BANNER: "https://cdn.discordapp.com/attachments/1315665568228966410/1540122036725350441/octopus_png_banner.png", 
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
        APPLY_SELLER: "<:apply:1540509721851863110>",
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
        buy_order: { name: "Buy Order", label: "Buy Order", description: "Create a buy order", categoryId: "1540504775760678952", roleId: "1540509073332641865", emoji: "<:SHOP:1539754401340858498>" },
        apply_seller: { name: "Apply Seller", label: "Apply Seller", description: "Apply to become a seller", categoryId: "1540504734191063070", roleId: "1540509073332641865", emoji: "<:apply:1540509721851863110>" }
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

    if (message.channel.parentId === CONFIG.TICKETS.buy_order.categoryId) {
        if (message.content.toLowerCase().startsWith('need')) {
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

    const ticketConfig = getTicketTypeByChannel(message.channel);
    if (!ticketConfig) return;

    const args = message.content.trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === '$close') {
        await message.reply(`${CONFIG.EMOJIS.LOCK} Closing ticket in 5 seconds...`);
        setTimeout(() => message.channel.delete().catch(() => {}), 5000);
    }

    if (command === '$claim') {
        const hasStaffRole = message.member.roles.cache.has(ticketConfig.roleId);
        if (!hasStaffRole && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply(`${CONFIG.EMOJIS.ERROR} Only staff members can claim this ticket!`);
        }
        const newName = `claimed-by-${message.author.username}`;
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
                    `• ${CONFIG.EMOJIS.BUY_ORDER} **${CONFIG.TICKETS.buy_order.label}** : ${CONFIG.TICKETS.buy_order.description} ${CONFIG.EMOJIS.SWORD}\n` +
                    `• ${CONFIG.EMOJIS.APPLY_SELLER} **${CONFIG.TICKETS.apply_seller.label}** : ${CONFIG.TICKETS.apply_seller.description} ${CONFIG.EMOJIS.SWORD}`
                )
                .setImage(CONFIG.SERVER_BANNER);

            // بناء الـ Dropdown Menu
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

        if (interaction.customId === 'modal_apply_seller') {
            const name = interaction.fields.getTextInputValue('app_name');
            const age = interaction.fields.getTextInputValue('app_age');
            const servers = interaction.fields.getTextInputValue('app_servers');
            const feedback = interaction.fields.getTextInputValue('app_feedback');
            const ranks = interaction.fields.getTextInputValue('app_ranks');

            const resultEmbed = new EmbedBuilder()
                .setColor("#2b2d31")
                .setTitle("📋 New Seller Application Submitted")
                .addFields(
                    { name: "ما هو اسمك الحقيقي", value: name },
                    { name: "ما هو عمرك", value: age },
                    { name: "ما عدد السيرفرات التي انت شغال فيها", value: servers },
                    { name: "معاك 10 فيدباك نعم او لا", value: feedback },
                    { name: "ما هي رتب البيع التي تقدم عليها انت", value: ranks }
                )
                .setTimestamp();

            await interaction.channel.send({ content: `**طلب جديد من <@${interaction.user.id}>**`, embeds: [resultEmbed] });
            await interaction.reply({ content: `${CONFIG.EMOJIS.SUCCESS} تم إرسال طلبك بنجاح!`, ephemeral: true });

            await interaction.channel.send(`+come <@&${CONFIG.TICKETS.apply_seller.roleId}>`);

            const role = interaction.guild.roles.cache.get(CONFIG.TICKETS.apply_seller.roleId);
            if (role) {
                role.members.forEach(member => {
                    member.send(`🔔 **طلب بائع جديد!** هناك تقديم جديد من <@${interaction.user.id}> في الروم: ${interaction.channel}`).catch(() => {});
                });
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
                    );

                await ticketChannel.send({ 
                    content: `<@&${CONFIG.BUY_ORDER_TAG_ROLE_ID}>`, 
                    embeds: [buyEmbed], 
                    components: [ticketControlRow] 
                });
            } 
            else if (selectedKey === 'apply_seller') {
                const applyEmbed = new EmbedBuilder()
                    .setColor("#2b2d31")
                    .setDescription(
                        `**Click On The Button To Start Team Apply Submit**\n` +
                        `برجاء الضغط علي البتن لبدئ التقديم الي طاقم العمل\n\n` +
                        `⚠️ **ملحوظه : لو مضغطتش علي البتن و كملت مع البوت محدش هيرد عليك**`
                    );

                const applyBtnRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_click_apply').setLabel('Click Here').setStyle(ButtonStyle.Primary)
                );

                await ticketChannel.send({ embeds: [applyEmbed], components: [applyBtnRow, ticketControlRow] });
            } 
            else {
                const embedMsg = new EmbedBuilder()
                    .setColor("#2b2d31")
                    .setTitle(`Ticket: ${selectedTicket.name}`)
                    .setDescription(`Welcome <@${interaction.user.id}>! Staff will assist you shortly.`)
                    .setThumbnail(client.user.displayAvatarURL());

                await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embedMsg], components: [ticketControlRow] });
            }

            // إرسال الرد بشكل Ephemeral باش ميتأثرش بصلاحيات الكتابة
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

        if (interaction.customId === 'btn_click_apply') {
            const modal = new ModalBuilder().setCustomId('modal_apply_seller').setTitle('Apply Team Submit');

            const input1 = new TextInputBuilder().setCustomId('app_name').setLabel('ما هو اسمك الحقيقي').setStyle(TextInputStyle.Short).setRequired(true);
            const input2 = new TextInputBuilder().setCustomId('app_age').setLabel('ما هو عمرك').setStyle(TextInputStyle.Short).setRequired(true);
            const input3 = new TextInputBuilder().setCustomId('app_servers').setLabel('ما عدد السيرفرات التي انت شغال فيها').setStyle(TextInputStyle.Short).setRequired(true);
            const input4 = new TextInputBuilder().setCustomId('app_feedback').setLabel('معاك 10 فيدباك نعم او لا').setStyle(TextInputStyle.Short).setRequired(true);
            const input5 = new TextInputBuilder().setCustomId('app_ranks').setLabel('ما هي رتب البيع التي تقدم عليها انت').setStyle(TextInputStyle.Paragraph).setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(input1),
                new ActionRowBuilder().addComponents(input2),
                new ActionRowBuilder().addComponents(input3),
                new ActionRowBuilder().addComponents(input4),
                new ActionRowBuilder().addComponents(input5)
            );

            return interaction.showModal(modal);
        }

        if (interaction.customId === 'ticket_close') {
            await interaction.reply({ content: `${CONFIG.EMOJIS.LOCK} Closing ticket in 5 seconds...` });
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
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
            const newName = `claimed-by-${interaction.user.username}`;
            
            try {
                await interaction.channel.setName(newName);
            } catch (err) {}

            return interaction.editReply({ content: `${CONFIG.EMOJIS.SUCCESS} Claimed by **<@${interaction.user.id}>**!` });
        }
    }
});

client.login(CONFIG.TOKEN);
